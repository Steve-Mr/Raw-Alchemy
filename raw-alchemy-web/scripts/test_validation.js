/* eslint-disable no-undef */
import { validateFile } from '../src/utils/validation.js';

console.log("🛡️ Sentinel: Verifying validation logic...");

// Mock File class (limited implementation for Node)
class MockFile {
    constructor(name, size) {
        this.name = name;
        this.size = size;
    }
}

const tests = [
    {
        name: "Valid ARW file",
        file: new MockFile("photo.ARW", 1000),
        expected: true
    },
    {
        name: "Valid DNG file (lowercase)",
        file: new MockFile("photo.dng", 1000),
        expected: true
    },
    {
        name: "Invalid Extension (JPG)",
        file: new MockFile("photo.jpg", 1000),
        expected: false
    },
    {
        name: "Invalid Extension (EXE)",
        file: new MockFile("malware.exe", 1000),
        expected: false
    },
    {
        name: "File too large (201MB)",
        file: new MockFile("huge.ARW", 201 * 1024 * 1024),
        expected: false
    },
    {
        name: "File exactly limit (200MB)",
        file: new MockFile("limit.ARW", 200 * 1024 * 1024),
        expected: true
    }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
    const result = validateFile(test.file);
    if (result.valid === test.expected) {
        console.log(`✅ PASS: ${test.name}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${test.name}`);
        console.error(`   Expected: ${test.expected}, Got: ${result.valid}`);
        if (result.error) console.error(`   Error: ${result.error}`);
        failed++;
    }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
