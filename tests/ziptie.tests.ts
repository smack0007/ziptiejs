/// <reference path="../src/ziptie.ts" />

describe("ZipTie", () => {
    describe("parseTextBinding", () => {
        const tests: { input: string, expected: string[] }[] = [
            {
                input: "No variables to replace here.",
                expected: [ "No variables to replace here." ]
            },
            {
                input: "{{ item }}",
                expected: [ "{{1}}", "item" ]
            },
            {
                input: "{{ item }}: {{ clickCount }}",
                expected: [ "{{1}}: {{2}}", "item", "clickCount" ]
            },
            {
                input: "This is the {{ item }} to replace.",
                expected: [ "This is the {{1}} to replace.", "item" ]
            }
        ];
        
        for (const test of tests) {
            const testName = `"${test.input}" => [ ${test.expected.map(x => `"${x}"`).join(",")} ]`;

            it (testName, () => {
                expect(ZipTie.parseTextBinding(test.input)).toEqual(test.expected);
            });
        }
    });
});