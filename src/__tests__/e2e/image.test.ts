/**
 * E2E tests for image operations — new PDFDancer API
 */

import * as fs from 'fs';
import {Color, FlipDirection, Image, PDFDancer, ValidationException} from '../../index';
import {createTempPath, getImagePath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

describe('Image E2E Tests (v2 API)', () => {

    test('find images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        expect(images).toHaveLength(3);
        expect(images[0].type).toBe('IMAGE');

        const imagesOnPage1 = await pdf.page(1).selectImages();
        expect(imagesOnPage1).toHaveLength(2);
    });

    test('delete images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        expect(images).toHaveLength(3);
        for (const img of images) {
            await img.delete();
        }

        expect(await pdf.selectImages()).toHaveLength(0);

        const outPath = createTempPath('deleteImage.pdf');
        const outData = await pdf.getBytes();
        fs.writeFileSync(outPath, outData);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);
        fs.unlinkSync(outPath);

        const assertions = await PDFAssertions.create(pdf);
        const pages = await pdf.pages();
        for (const page of pages) {
            await assertions.assertNumberOfImages(0, page.position.pageNumber);
        }
    });

    test('move image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        const image = images[2];

        const originalX = image.position.boundingRect?.x!;
        const originalY = image.position.boundingRect?.y!;
        const pageNumber = image.position.pageNumber!;

        expectWithin(originalX, 54, 0.5);
        expectWithin(originalY, 300, 1);
        expect(pageNumber).toBe(12);

        const newX = 500.1;
        const newY = 600.1;
        await image.moveTo(newX, newY);

        const moved = await pdf.page(pageNumber).selectImagesAt(newX, newY);
        expect(moved).toHaveLength(1);
        expectWithin(moved[0].position.boundingRect?.x, newX, 0.05);
        expectWithin(moved[0].position.boundingRect?.y, newY, 0.05);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(newX, newY, pageNumber);
        await assertions.assertNoImageAt(originalX, originalY, pageNumber);
    });

    test('find image by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const none = await pdf.page(12).selectImagesAt(0, 0);
        expect(none).toHaveLength(0);

        const found = await pdf.page(12).selectImagesAt(54, 300, 1);
        expect(found).toHaveLength(1);
        expect(found[0].internalId).toBe('IMAGE_11_000001');
    });

    test('add image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const before = await pdf.selectImages();
        expect(before).toHaveLength(3);

        const result = await pdf.newImage()
            .fromFile(getImagePath('logo-80.png'))
            .at(6, 50.1, 98.0)
            .add();

        expect(result).toBeTruthy();

        const after = await pdf.selectImages();
        expect(after).toHaveLength(4);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(50.1, 98.0, 6);
        await assertions.assertNumberOfImages(1, 6);
    });

    // Tests for singular select methods
    test('selectImage returns first image or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with results - page 11 has images
        const image = await pdf.page(12).selectImage();
        expect(image).not.toBeNull();
        expect(image!.internalId).toBe('IMAGE_11_000001');

        // Test with PDFDancer class
        const imageFromPdf = await pdf.selectImage();
        expect(imageFromPdf).not.toBeNull();
        expect(imageFromPdf!.internalId).toBe('IMAGE_0_000001');

        // Test page 1 also has images (2 images)
        const imageOnPage1 = await pdf.page(1).selectImage();
        expect(imageOnPage1).not.toBeNull();
        expect(imageOnPage1!.internalId).toBe('IMAGE_0_000001');
    });

    test('selectImageAt returns first image at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const image = await pdf.page(12).selectImageAt(54, 300, 1);
        expect(image).not.toBeNull();
        expect(image!.internalId).toBe('IMAGE_11_000001');

        // Test with no match
        const noMatch = await pdf.page(12).selectImageAt(0, 0);
        expect(noMatch).toBeNull();
    });
});

describe('Image Transform E2E Tests', () => {
    // Uses basic-image-test.pdf which contains 3 images:
    // - IMAGE_000001: 100x100 square at (50, 600)
    // - IMAGE_000002: 150x100 wide at (200, 600) - aspect ratio 1.5
    // - IMAGE_000003: 100x150 tall at (400, 600) - aspect ratio 0.67

    test('scale square image by factor', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        expect(images).toHaveLength(3);

        // Use the square image (100x100)
        const image = images[0];
        const imageId = image.internalId;
        expect(image.position.boundingRect!.width).toBe(100);
        expect(image.position.boundingRect!.height).toBe(100);

        const result = await image.scale(0.5);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 50, 50, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 1.0, 1);
    });

    test('scale wide image preserves aspect ratio', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        expect(images).toHaveLength(3);

        // Use the wide image (150x100, ratio 1.5)
        const image = images[1];
        const imageId = image.internalId;
        expect(image.position.boundingRect!.width).toBe(150);
        expect(image.position.boundingRect!.height).toBe(100);

        const result = await image.scale(2.0);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 300, 200, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 1.5, 1);
    });

    test('scale to target size preserving aspect ratio', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the wide image (150x100, ratio 1.5)
        const image = images[1];
        const imageId = image.internalId;

        // Target 60x60, but aspect ratio 1.5 means it should become 60x40
        const result = await image.scaleTo(60, 60, true);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAspectRatio(imageId, 1.5, 1);
        const newSize = await assertions.getImageSize(imageId, 1);
        expect(newSize).toBeDefined();
        // Width should be constrained to 60, height proportional
        expect(newSize!.width).toBeCloseTo(60, 0);
        expect(newSize!.height).toBeCloseTo(40, 0);
    });

    test('scale to target size without preserving aspect ratio', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the square image (100x100)
        const image = images[0];
        const imageId = image.internalId;

        // Stretch to 200x50 (ratio 4.0)
        const result = await image.scaleTo(200, 50, false);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 200, 50, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 4.0, 1);
    });

    test('rotate square image 90 degrees', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the square image (100x100)
        const image = images[0];
        const imageId = image.internalId;

        const result = await image.rotate(90);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        // Square stays square after rotation
        await assertions.assertImageSize(imageId, 100, 100, 1, 1);
    });

    test('rotate wide image 90 degrees swaps dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the wide image (150x100)
        const image = images[1];
        const imageId = image.internalId;

        const result = await image.rotate(90);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        // After 90 degree rotation, 150x100 becomes 100x150
        await assertions.assertImageSize(imageId, 100, 150, 1, 1);
        // Aspect ratio inverts from 1.5 to 0.67
        await assertions.assertImageAspectRatio(imageId, 100/150, 1, 0.01);
    });

    test('rotate tall image 180 degrees preserves dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the tall image (100x150)
        const image = images[2];
        const imageId = image.internalId;

        const result = await image.rotate(180);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        // 180 degree rotation preserves dimensions
        await assertions.assertImageSize(imageId, 100, 150, 1, 1);
    });

    test('crop square image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the square image (100x100)
        const image = images[0];
        const imageId = image.internalId;

        // Crop 10 from each side: 100-20=80 x 100-20=80
        const result = await image.crop(10, 10, 10, 10);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 80, 80, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 1.0, 1);
    });

    test('crop wide image asymmetrically', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the wide image (150x100)
        const image = images[1];
        const imageId = image.internalId;

        // Crop 50 from left only: 150-50=100 x 100 (becomes square)
        const result = await image.crop(50, 0, 0, 0);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 100, 100, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 1.0, 1);
    });

    test('set opacity on square image preserves dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];
        const imageId = image.internalId;

        const result = await image.setOpacity(0.5);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 100, 100, 1, 1);
    });

    test('flip wide image horizontally preserves dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the wide image (150x100)
        const image = images[1];
        const imageId = image.internalId;

        const result = await image.flip(FlipDirection.HORIZONTAL);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 150, 100, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 1.5, 1);
    });

    test('flip tall image vertically preserves dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        // Use the tall image (100x150)
        const image = images[2];
        const imageId = image.internalId;

        const result = await image.flip(FlipDirection.VERTICAL);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 100, 150, 1, 1);
        await assertions.assertImageAspectRatio(imageId, 100/150, 1, 0.01);
    });

    test('flip square image both directions preserves dimensions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];
        const imageId = image.internalId;

        const result = await image.flip(FlipDirection.BOTH);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageSize(imageId, 100, 100, 1, 1);
    });

    test('replace square image with new image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        expect(images).toHaveLength(3);

        const image = images[0];

        // Create a new image from file
        const imagePath = getImagePath('logo-80.png');
        const imageData = fs.readFileSync(imagePath);
        const newImage = new Image(
            undefined,
            'PNG',
            80,
            80,
            new Uint8Array(imageData)
        );

        const result = await image.replace(newImage);
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfImages(3, 1);
    });

    test('scale with invalid factor throws error', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.scale(-1)).rejects.toThrow('Scale factor must be positive');
        await expect(image.scale(0)).rejects.toThrow('Scale factor must be positive');
    });

    test('opacity with invalid value throws error', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.setOpacity(-0.1)).rejects.toThrow('Opacity must be between 0.0 and 1.0');
        await expect(image.setOpacity(1.5)).rejects.toThrow('Opacity must be between 0.0 and 1.0');
    });

    test('crop with negative values throws error', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.crop(-10, 10, 10, 10)).rejects.toThrow('Crop values cannot be negative');
    });

    test('scaleTo with invalid dimensions throws error', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.scaleTo(0, 100)).rejects.toThrow('Target size must be positive');
        await expect(image.scaleTo(100, -50)).rejects.toThrow('Target size must be positive');
    });
});

describe('Image Fill Region E2E Tests', () => {

    test('fill region basic', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        expect(images).toHaveLength(3);

        const image = images[0];
        const result = await image.fillRegion(10, 10, 50, 30, new Color(0, 0, 0));
        expect(result.success).toBe(true);
    });

    test('fill region with red', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        const result = await image.fillRegion(0, 0, 5, 5, new Color(255, 0, 0));
        expect(result.success).toBe(true);
    });

    test('fill region with different colors', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image1 = images[0];
        const result1 = await image1.fillRegion(0, 0, 10, 10, new Color(255, 255, 255));
        expect(result1.success).toBe(true);

        // Re-select to get fresh reference
        const images2 = await pdf.page(1).selectImages();
        const image2 = images2[0];
        const result2 = await image2.fillRegion(20, 20, 10, 10, new Color(0, 0, 255));
        expect(result2.success).toBe(true);
    });

    test('fill region invalid width', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.fillRegion(10, 10, 0, 30, new Color(0, 0, 0))).rejects.toThrow(ValidationException);
    });

    test('fill region invalid height', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.fillRegion(10, 10, 50, -5, new Color(0, 0, 0))).rejects.toThrow(ValidationException);
    });

    test('fill region invalid color type', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-image-test.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        const image = images[0];

        await expect(image.fillRegion(10, 10, 50, 30, 0xFF0000 as any)).rejects.toThrow(ValidationException);
    });
});
