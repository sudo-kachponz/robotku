// node --test test/relay.test.mjs — session rules of the RelayRoom Durable Object,
// exercised with fake sockets (no wrangler needed). Covers the failure modes that
// kept recurring: half-open robot, owner locked out by 4409, robot reboot killing
// the controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RelayRoom } from '../src/worker.js';

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
