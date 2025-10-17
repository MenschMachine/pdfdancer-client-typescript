/**
 * Tests for StandardFonts enum.
 */

import { StandardFonts, Font } from '../models';

describe('StandardFonts', () => {
    test('should have all 14 standard PDF fonts', () => {
        const standardFonts = Object.values(StandardFonts);
        expect(standardFonts).toHaveLength(14);
    });

    test('should have Times family fonts', () => {
        expect(StandardFonts.TIMES_ROMAN).toBe('Times-Roman');
        expect(StandardFonts.TIMES_BOLD).toBe('Times-Bold');
        expect(StandardFonts.TIMES_ITALIC).toBe('Times-Italic');
        expect(StandardFonts.TIMES_BOLD_ITALIC).toBe('Times-BoldItalic');
    });

    test('should have Helvetica family fonts', () => {
        expect(StandardFonts.HELVETICA).toBe('Helvetica');
        expect(StandardFonts.HELVETICA_BOLD).toBe('Helvetica-Bold');
        expect(StandardFonts.HELVETICA_OBLIQUE).toBe('Helvetica-Oblique');
        expect(StandardFonts.HELVETICA_BOLD_OBLIQUE).toBe('Helvetica-BoldOblique');
    });

    test('should have Courier family fonts', () => {
        expect(StandardFonts.COURIER).toBe('Courier');
        expect(StandardFonts.COURIER_BOLD).toBe('Courier-Bold');
        expect(StandardFonts.COURIER_OBLIQUE).toBe('Courier-Oblique');
        expect(StandardFonts.COURIER_BOLD_OBLIQUE).toBe('Courier-BoldOblique');
    });

    test('should have Symbol font', () => {
        expect(StandardFonts.SYMBOL).toBe('Symbol');
    });

    test('should have ZapfDingbats font', () => {
        expect(StandardFonts.ZAPF_DINGBATS).toBe('ZapfDingbats');
    });

    test('should work with Font class', () => {
        const font = new Font(StandardFonts.HELVETICA, 12);
        expect(font.name).toBe('Helvetica');
        expect(font.size).toBe(12);
    });

    test('should work with all standard fonts in Font class', () => {
        for (const standardFont of Object.values(StandardFonts)) {
            const font = new Font(standardFont, 10);
            expect(font.name).toBe(standardFont);
            expect(font.size).toBe(10);
        }
    });

    test('should have correct font name formats', () => {
        expect(StandardFonts.TIMES_BOLD_ITALIC).toMatch(/^Times-[A-Za-z]+$/);
        expect(StandardFonts.HELVETICA_BOLD_OBLIQUE).toMatch(/^Helvetica-[A-Za-z]+$/);
        expect(StandardFonts.COURIER_BOLD_OBLIQUE).toMatch(/^Courier-[A-Za-z]+$/);
    });

    test('should have unique font names', () => {
        const fontNames = Object.values(StandardFonts);
        const uniqueFontNames = new Set(fontNames);
        expect(uniqueFontNames.size).toBe(fontNames.length);
    });

    test('enum keys should match convention', () => {
        expect(Object.keys(StandardFonts)).toContain('TIMES_ROMAN');
        expect(Object.keys(StandardFonts)).toContain('HELVETICA');
        expect(Object.keys(StandardFonts)).toContain('COURIER');
        expect(Object.keys(StandardFonts)).toContain('SYMBOL');
        expect(Object.keys(StandardFonts)).toContain('ZAPF_DINGBATS');
    });

    test('should be compatible with string type', () => {
        const fontName: string = StandardFonts.HELVETICA;
        expect(typeof fontName).toBe('string');
        expect(fontName).toBe('Helvetica');
    });

    test('standard fonts should not have spaces', () => {
        for (const standardFont of Object.values(StandardFonts)) {
            expect(standardFont).not.toContain(' ');
        }
    });
});
