/**
 * E2E tests for image operations — new PDFDancer API
 */

import * as fs from 'fs';
import {PDFDancer} from '../../index';
import {createTempPath, getImagePath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

describe('Image E2E Tests (v2 API)', () => {

    test('find images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const images = await pdf.selectImages();
        expect(images).toHaveLength(3);
        expect(images[0].type).toBe('IMAGE');

        const imagesOnPage0 = await pdf.page(0).selectImages();
        expect(imagesOnPage0).toHaveLength(2);
    });

    test('delete images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

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
            await assertions.assertNumberOfImages(0, page.position.pageIndex);
        }
    });

    test('move image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const images = await pdf.selectImages();
        const image = images[2];

        const originalX = image.position.boundingRect?.x!;
        const originalY = image.position.boundingRect?.y!;
        const pageIndex = image.position.pageIndex!;

        expectWithin(originalX, 54, 0.5);
        expectWithin(originalY, 300, 1);
        expect(pageIndex).toBe(11);

        const newX = 500.1;
        const newY = 600.1;
        await image.moveTo(newX, newY);

        const moved = await pdf.page(pageIndex).selectImagesAt(newX, newY);
        expect(moved).toHaveLength(1);
        expectWithin(moved[0].position.boundingRect?.x, newX, 0.05);
        expectWithin(moved[0].position.boundingRect?.y, newY, 0.05);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(newX, newY, pageIndex);
        await assertions.assertNoImageAt(originalX, originalY, pageIndex);
    });

    test('find image by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const none = await pdf.page(11).selectImagesAt(0, 0);
        expect(none).toHaveLength(0);

        const found = await pdf.page(11).selectImagesAt(54, 300, 1);
        expect(found).toHaveLength(1);
        expect(found[0].internalId).toBe('IMAGE_000003');
    });

    test('add image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

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
});
