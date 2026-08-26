# Robotku Templates

The Template Gallery's built-in programs (PROMPT D). Templates are **authored as
block-spec trees**, not hand-written Blockly JSON — `authoring.ts` builds a real
headless workspace from the specs and serialises it, so the workspace JSON is
always valid and stays in sync with the block definitions.

## Adding / editing a built-in

1. Open the relevant collection file in `builtin/` (`gerakDasar.ts`, `sensor.ts`,
   `aiKamera.ts`, `seniSuara.ts`, `tantangan.ts`).
2. Add a `BuiltinTemplate` with a `program: BlockSpec[]` body. A `BlockSpec` is:

   ```ts
   { type, fields?, inputs?, statements?, extraState? }
   ```

   - `inputs` values may be a number, a string, or a nested `BlockSpec` (value block).
   - `statements` maps a statement input name (`DO`, `DO0`, `ELSE`, `STACK`, …) to a
     list of child specs.
   - `extraState` sets mutator state, e.g. `{ elseIfCount: 1, hasElse: true }` for
     `controls_if`.
   - Variable fields (`variables_set`/`variables_get` `VAR`) take the variable **name**.

3. Register it in the collection's exported array and in `builtin/index.ts`.
4. Give it an animated `thumbnail` from `thumbnails.ts` (or a new generator there).

## Authoring from the editor (optional)

`buildTemplateWorkspace(specs)` mirrors how the editor serialises a workspace, so a
template built in the editor and one built from specs produce the same shape. To
capture a program you built by hand, run `Blockly.serialization.workspaces.save(ws)`
in the console and translate it into specs.

## The safety net

`src/test/templates.builtin.test.ts` loads **every** built-in into a headless
workspace, generates its program, and runs it in `SimSink`. A non-AI template that
changes no state fails the build; AI-camera templates (which need PROMPT E to see
anything) only have to build + generate. This is why a broken template can't ship.

## Insertion

`insert.ts` handles loading a template into the live editor:

- **replace** — clears the canvas and loads the template.
- **append** — drops the body as a fresh stack to the right, giving every block a
  new id (`Blockly.utils.idGenerator.genUid()`) and reusing/creating variables by
  name, so inserting the same template twice never collides.

Both run inside one `Blockly.Events` group, so a single Ctrl+Z removes a whole
template, and the new stack flashes gold (`.blocklyTemplateFlash`).
