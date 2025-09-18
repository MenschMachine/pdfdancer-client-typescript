/**
 * Basic tests for the PDFDancer TypeScript client.
 */

import { ClientV1 } from '../client-v1';
import { ValidationException } from '../exceptions';
import { Position, Color, Font, Paragraph } from '../models';

describe('ClientV1', () => {
  const mockToken = 'test-token';
  const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header

  describe('constructor validation', () => {
    test('should throw ValidationException for empty token', () => {
      expect(() => {
        new ClientV1('', mockPdfData);
      }).toThrow(ValidationException);
    });

    test('should throw ValidationException for null PDF data', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new ClientV1(mockToken, (null as any));
      }).toThrow(ValidationException);
    });

    test('should throw ValidationException for empty PDF data', () => {
      expect(() => {
        new ClientV1(mockToken, new Uint8Array(0));
      }).toThrow(ValidationException);
    });

    test('should accept valid parameters', () => {
      expect(() => {
        new ClientV1(mockToken, mockPdfData);
      }).not.toThrow();
    });
  });

  describe('paragraphBuilder', () => {
    test('should create a ParagraphBuilder instance', () => {
      const client = new ClientV1(mockToken, mockPdfData);
      const builder = client.paragraphBuilder();
      expect(builder).toBeDefined();
    });
  });
});

describe('Position', () => {
  test('should create position from page index', () => {
    const position = Position.atPage(1);
    expect(position.pageIndex).toBe(1);
  });

  test('should create position with coordinates', () => {
    const position = Position.onPageCoordinates(1, 100, 200);
    expect(position.pageIndex).toBe(1);
    expect(position.getX()).toBe(100);
    expect(position.getY()).toBe(200);
  });

  test('should move position', () => {
    const position = Position.onPageCoordinates(1, 100, 200);
    position.moveX(50).moveY(30);
    expect(position.getX()).toBe(150);
    expect(position.getY()).toBe(230);
  });
});

describe('Color', () => {
  test('should create valid color', () => {
    const color = new Color(255, 128, 0, 200);
    expect(color.r).toBe(255);
    expect(color.g).toBe(128);
    expect(color.b).toBe(0);
    expect(color.a).toBe(200);
  });

  test('should throw error for invalid color values', () => {
    expect(() => new Color(256, 0, 0)).toThrow();
    expect(() => new Color(0, -1, 0)).toThrow();
  });
});

describe('Font', () => {
  test('should create valid font', () => {
    const font = new Font('Arial', 12);
    expect(font.name).toBe('Arial');
    expect(font.size).toBe(12);
  });

  test('should throw error for invalid font size', () => {
    expect(() => new Font('Arial', 0)).toThrow();
    expect(() => new Font('Arial', -5)).toThrow();
  });
});

describe('Paragraph', () => {
  test('should create paragraph with position', () => {
    const position = Position.atPage(1);
    const paragraph = new Paragraph(position);
    expect(paragraph.getPosition()).toBe(position);
  });

  test('should set position', () => {
    const paragraph = new Paragraph();
    const position = Position.atPage(2);
    paragraph.setPosition(position);
    expect(paragraph.getPosition()).toBe(position);
  });
});
