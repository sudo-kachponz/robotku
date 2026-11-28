// node --test test/relay.test.mjs — session rules of the RelayRoom Durable Object,
// exercised with fake sockets (no wrangler needed). Covers the failure modes that
// kept recurring: half-open robot, owner locked out by 4409, robot reboot killing
// the controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { RelayRoom } from '../src/worker.js';
import { createHmac } from 'node:crypto';
import postgres from 'postgres';
import { robotSecret, normalizePassword, passwordHash, randomPassword, webToken, verifyWebToken } from '../src/boxcode.js';

class FakeWs {
  constructor(name) { this.name = name; this.readyState = 1; this.sent = []; this.closed = null; this.l = {}; }
  addEventListener(t, fn) { (this.l[t] ||= []).push(fn); }
  emit(t, ev = {}) { for (const fn of this.l[t] || []) fn(ev); }
  send(d) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(String(d)); }
  close(code, reason) { if (this.closed) return; this.closed = { code, reason }; this.readyState = 3; this.emit('close', { code, reason }); }
  events() { return this.sent.filter((s) => s.includes('"RELAY"')).map((s) => JSON.parse(s.replace(/;$/, '')).event); }
}
const room = () => { const r = new RelayRoom({}, {}); r.startIdleTimer = () => {}; return r; };

test('controller is refused when the robot socket is OPEN but silent (half-open)', () => {
  const r = room();
  const robot = new FakeWs('robot');
  r.handleRobot(robot, 'ABC234');
  r.robotLastSeen = Date.now() - 60_000; // no robot_alive for a minute
  const web = new FakeWs('web');
  r.handleController(web, 'ABC234', '1.1.1.1');
  assert.equal(web.closed.code, 4404);
  assert.equal(r.robot, null);
});

test('newest controller takes over instead of 4409', () => {
  const r = room();
  r.handleRobot(new FakeWs('robot'), 'ABC234');
  const tab1 = new FakeWs('tab1');
  const tab2 = new FakeWs('tab2');
  r.handleController(tab1, 'ABC234', 'ip');
  r.handleController(tab2, 'ABC234', 'ip');
  assert.equal(tab1.closed.code, 4412);
  assert.equal(tab2.closed, null);
  assert.equal(r.controller, tab2);
  assert.deepEqual(tab2.events(), ['linked']);
});

test('robot reboot keeps the controller and tells it to re-HELLO', () => {
  const r = room();
  const robot1 = new FakeWs('robot1');
  r.handleRobot(robot1, 'ABC234');
  const web = new FakeWs('web');
  r.handleController(web, 'ABC234', 'ip');
  robot1.close(1006, 'brownout');
  assert.equal(web.closed, null, 'controller must survive a robot reboot');
  assert.ok(web.events().includes('robot_offline'));
  const robot2 = new FakeWs('robot2');
  r.handleRobot(robot2, 'ABC234');
  assert.ok(web.events().includes('robot_reconnected'));
  assert.ok(robot2.events().includes('controller_joined'));
  r.stopGraceTimer();
});

test('robot_alive beacons are not forwarded, real frames are', () => {
  const r = room();
  const robot = new FakeWs('robot');
  r.handleRobot(robot, 'ABC234');
  const web = new FakeWs('web');
  r.handleController(web, 'ABC234', 'ip');
  robot.emit('message', { data: '{"command":"RELAY","event":"robot_alive"};' });
  robot.emit('message', { data: '{"command":"HELLO_ACK","fw":"x"};' });
  assert.equal(web.sent.filter((s) => s.includes('robot_alive')).length, 0);
  assert.equal(web.sent.filter((s) => s.includes('HELLO_ACK')).length, 1);
});

test('controller commands reach the robot', () => {
  const r = room();
  const robot = new FakeWs('robot');
  r.handleRobot(robot, 'ABC234');
  const web = new FakeWs('web');
  r.handleController(web, 'ABC234', 'ip');
  web.emit('message', { data: '{"command":"PLAY_TONE","params":{"hz":880,"target":"buzzer"}};\n' });
  assert.ok(robot.sent.some((s) => s.includes('PLAY_TONE')));
});

// ── Hardware passwords -> relay login (/login, Postgres) ──
const KEY = 'test-signing-key';

test('robot token is unchanged (same as gen-robot-id.mjs)', async () => {
  const want = createHmac('sha256', KEY).update('ABC234').digest('hex').slice(0, 32);
  assert.equal(await robotSecret(KEY, 'ABC234'), want);
});

test('passwords: printable format, sloppy typing accepted, hash is stable', async () => {
  const pw = randomPassword();
  assert.match(pw, /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/);
  assert.equal(await passwordHash(' rk ' + pw.toLowerCase().replace(/-/g, ' ')), await passwordHash(pw));
  assert.equal(normalizePassword('ABCD-EFGH-IJKL-MNOP'), null); // I/O not in the alphabet
  assert.equal(await passwordHash('too-short'), null);
});

test('web token: valid for its robot only, until it expires', async () => {
  const now = Date.now();
  const t = await webToken(KEY, 'ABC234', 30, now);
  assert.equal(await verifyWebToken(KEY, 'ABC234', t, now), true);
  assert.equal(await verifyWebToken(KEY, 'XYZ789', t, now), false);
  assert.equal(await verifyWebToken('other-key', 'ABC234', t, now), false);
  assert.equal(await verifyWebToken(KEY, 'ABC234', t, now + 31 * 86400e3), false);
  assert.equal(await verifyWebToken(KEY, 'ABC234', 'garbage', now), false);
});

// Integration with a real Postgres: TEST_DATABASE_URL=postgres://... npm test
const DB = process.env.TEST_DATABASE_URL;
test('/login against Postgres: right / wrong / revoked password, CORS, claim stamp', { skip: !DB && 'set TEST_DATABASE_URL' }, async () => {
  const sql = postgres(DB, { max: 1 });
  const pw = randomPassword();
  const revokedPw = randomPassword();
  try {
    await sql`delete from robot_devices where label like 'test-%'`;
    await sql`insert into robot_devices (password_hash, relay_id, label) values (${await passwordHash(pw)}, 'TST234', 'test-ok')`;
    await sql`insert into robot_devices (password_hash, relay_id, label, revoked) values (${await passwordHash(revokedPw)}, 'TST235', 'test-revoked', true)`;
    const env = { RELAY_SIGNING_KEY: KEY, DATABASE_URL: DB, ALLOWED_ORIGINS: 'https://hub.robotku.id' };
    const login = (password, origin = 'https://hub.robotku.id', path = '/login') =>
      worker.fetch(new Request('https://relay.test' + path, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }), env);

    let r = await login(pw.toLowerCase());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://hub.robotku.id');
    const ok = await r.json();
    assert.equal(ok.id, 'TST234');
    assert.equal(ok.secret, await robotSecret(KEY, 'TST234'));       // robot can log in with it
    assert.equal(await verifyWebToken(KEY, 'TST234', ok.token), true); // controller token
    const [row] = await sql`select claimed_at, login_count from robot_devices where relay_id = 'TST234'`;
    assert.ok(row.claimed_at);
    assert.equal(row.login_count, 1);

    assert.equal((await login(pw, 'https://hub.robotku.id', '/provision')).status, 200); // wizard alias
    assert.equal((await login(randomPassword())).status, 403);
    assert.equal((await login(revokedPw)).status, 403);
    assert.equal((await login('nope')).status, 400);
    assert.equal((await login(pw, 'https://evil.example')).status, 403);
  } finally {
    await sql`delete from robot_devices where label like 'test-%'`;
    await sql.end();
  }
});
