const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { copySkills } = require("../../lib/utils/skill-copier");
const { createTempDir, cleanupDir, captureConsole } = require("../helpers/test-utils");

// ============================================================================
// copySkills - basic functionality tests
// ============================================================================

test("copySkills copies files from source to target", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file1.txt"), "content1");
  fs.writeFileSync(path.join(sourceDir, "file2.txt"), "content2");

  const copied = copySkills(sourceDir, targetDir);

  assert.equal(copied.length, 2);
  assert.ok(fs.existsSync(path.join(targetDir, "file1.txt")));
  assert.ok(fs.existsSync(path.join(targetDir, "file2.txt")));
});

test("copySkills copies subdirectories recursively", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(path.join(sourceDir, "subdir"));

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "root.txt"), "root content");
  fs.writeFileSync(path.join(sourceDir, "subdir", "nested.txt"), "nested content");

  const copied = copySkills(sourceDir, targetDir);

  assert.equal(copied.length, 2);
  assert.ok(fs.existsSync(path.join(targetDir, "root.txt")));
  assert.ok(fs.existsSync(path.join(targetDir, "subdir", "nested.txt")));
});

// ============================================================================
// copySkills - error handling tests
// ============================================================================

test("copySkills throws on missing sourceDir", () => {
  assert.throws(
    () => copySkills(null, "/target"),
    /copySkills requires sourceDir and targetDir/
  );
});

test("copySkills throws on missing targetDir", () => {
  assert.throws(
    () => copySkills("/source", null),
    /copySkills requires sourceDir and targetDir/
  );
});

test("copySkills throws when source does not exist", () => {
  assert.throws(
    () => copySkills("/non/existent/source", "/target"),
    /Source directory not found/
  );
});

test("copySkills throws when source is a file not directory", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceFile = path.join(tempDir, "file.txt");
  fs.writeFileSync(sourceFile, "content");

  t.after(() => cleanupDir(tempDir));

  assert.throws(
    () => copySkills(sourceFile, path.join(tempDir, "target")),
    /Source directory not found/
  );
});

// ============================================================================
// copySkills - dry run tests
// ============================================================================

test("copySkills dry run does not create files", async (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file.txt"), "content");

  const { stdout } = await captureConsole(() => {
    const copied = copySkills(sourceDir, targetDir, { dryRun: true });
    return copied;
  });

  // dry-run should log what it would do
  assert.ok(stdout.some((line) => line.includes("[dry-run]")));
  // But not actually create the file
  assert.ok(!fs.existsSync(path.join(targetDir, "file.txt")));
});

test("copySkills dry run returns files that would be copied", async (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file.txt"), "content");

  let copied;
  await captureConsole(() => {
    copied = copySkills(sourceDir, targetDir, { dryRun: true });
  });

  assert.equal(copied.length, 1);
  assert.ok(copied[0].endsWith("file.txt"));
});

// ============================================================================
// copySkills - force option tests
// ============================================================================

test("copySkills skips existing files by default", async (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(targetDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file.txt"), "new content");
  fs.writeFileSync(path.join(targetDir, "file.txt"), "old content");

  const { stderr } = await captureConsole(() => {
    return copySkills(sourceDir, targetDir);
  });

  // Should warn about skipping
  assert.ok(stderr.some((line) => line.includes("Skipping existing file")));
  // Should not overwrite
  const content = fs.readFileSync(path.join(targetDir, "file.txt"), "utf8");
  assert.equal(content, "old content");
});

test("copySkills overwrites existing files with force option", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(targetDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file.txt"), "new content");
  fs.writeFileSync(path.join(targetDir, "file.txt"), "old content");

  const copied = copySkills(sourceDir, targetDir, { force: true });

  assert.equal(copied.length, 1);
  const content = fs.readFileSync(path.join(targetDir, "file.txt"), "utf8");
  assert.equal(content, "new content");
});

// ============================================================================
// copySkills - returns copied files list
// ============================================================================

test("copySkills returns absolute paths of copied files", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);

  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(sourceDir, "file.txt"), "content");

  const copied = copySkills(sourceDir, targetDir);

  assert.equal(copied.length, 1);
  assert.ok(path.isAbsolute(copied[0]));
  assert.equal(copied[0], path.join(targetDir, "file.txt"));
});

test("copySkills returns empty array for empty source directory", (t) => {
  const tempDir = createTempDir("skill-copier-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");
  fs.mkdirSync(sourceDir);

  t.after(() => cleanupDir(tempDir));

  const copied = copySkills(sourceDir, targetDir);

  assert.deepEqual(copied, []);
});
