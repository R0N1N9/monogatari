# The shared story format

The Monogatari suite's apps, [Sutōri](https://github.com/R0N1N9/sutori)
(desktop and web) and [Haiku](https://github.com/R0N1N9/haiku) (Android), are
written in different languages but are meant to keep one story in sync through
the person's Google Drive. They agree through the files here (**draft**: see
the status note in `STORY_FORMAT.md`):

| File | What it is |
|---|---|
| [`STORY_FORMAT.md`](STORY_FORMAT.md) | The specification: where things live in Drive, what a chapter, moment and photo look like, and how two devices' versions are combined. |
| [`fixtures/entities.json`](fixtures/entities.json) | Which files are valid, and that unknown fields survive a read-and-write. |
| [`fixtures/reconcile.json`](fixtures/reconcile.json) | Every rule for combining this device's version with Drive's. |
| [`fixtures/history.json`](fixtures/history.json) | How revision history is recorded on upload. |

**An app conforms when it passes every case in `fixtures/`.** The cases are
plain JSON, so any language can load them.

## Using the cases in an app

1. Copy `spec/fixtures/` into the app's test resources. In an Android project,
   that's `app/src/test/resources/spec/fixtures/`. Copy it again whenever this
   folder changes; the format version in `STORY_FORMAT.md` says when it does.
2. Write one test per file that loops over its `cases`:
   - **entities.json**: read `input` with the app's own reader; it must report
     `expect` (`valid`, `invalid` or `newer-format`). When
     `roundTripUnchanged` is true, writing the item back out must produce the
     same JSON object, unknown fields included. In Kotlin, keep the item as a
     `JsonObject` (or keep unknown keys alongside a data class) rather than
     decoding into a class that drops fields it doesn't know.
   - **reconcile.json**: pass `input` (`base`, `localChanged`, `local`,
     `remote`) to the app's reconcile function; compare `action`, `parent`
     and `notice` exactly. For `result`, check each listed field. A `null`
     value means the field must be absent; `alternates` is checked item by
     item, in order.
   - **history.json**: given `parent` (or null), the uploaded item's
     `history` must equal `expect`.
3. Each case has a `name` (and reconcile cases a `rule`, pointing at the
   section of `STORY_FORMAT.md`) to use as the test's display name.

The TypeScript reference implementation lives in Sutōri, in
[`src/story/sync/`](https://github.com/R0N1N9/sutori/tree/main/src/story/sync); its test
[`conformance.test.ts`](https://github.com/R0N1N9/sutori/blob/main/src/story/sync/conformance.test.ts)
shows the three loops above, and Sutōri keeps a copy of these fixtures in its
own `spec/fixtures/`.

## Changing the format

Change `STORY_FORMAT.md` and the cases together, in one commit, then update
each app until it passes again. See §10 of the spec for what needs a new
format version.
