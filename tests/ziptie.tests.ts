/// <reference path="../src/ziptie.ts" />

describe("ZipTie", () => {
    describe("parse", () => {
        it ("should work", () => {
            const input = "foobar";
            expect(ZipTie.parse(input)).toEqual(input);
        });
    });
});