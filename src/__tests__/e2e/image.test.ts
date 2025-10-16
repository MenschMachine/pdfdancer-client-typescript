/**
 * E2E tests for image operations — new PDFDancer API
 */

import * as fs from 'fs';
import {PDFDancer} from '../../index';
import {createTempPath, getImagePath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';

describe('Image E2E Tests (v2 API)', () => {

    test('find images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const images = await pdf.selectImages();
        expect(images).toHaveLength(3);
        expect(images[0].type).toBe('IMAGE');

        const imagesOnPage0 = await pdf.page(0).selectImages();
        expect(imagesOnPage0).toHaveLength(2);
    });

    test('delete images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const images = await pdf.selectImages();
        for (const img of images) {
            await img.delete();
        }

        const remaining = await pdf.selectImages();
        expect(remaining).toHaveLength(0);

        const outPath = createTempPath('deleteImage.pdf');
        const outData = await pdf.getPdfFile();
        fs.writeFileSync(outPath, outData);

        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        fs.unlinkSync(outPath);
    });

    test('move image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const images = await pdf.selectImages();
        const image = images[2];

        expectWithin(image.position.boundingRect?.x, 54, 0.5);
        expectWithin(image.position.boundingRect?.y, 300, 1);

        await image.moveTo(50.1, 100);

        const moved = (await pdf.selectImages())[2];
        expectWithin(moved.position.boundingRect?.x, 50.1, 0.05);
        expectWithin(moved.position.boundingRect?.y, 100, 0.05);
    });

    test('find image by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const none = await pdf.page(11).selectImagesAt(0, 0);
        expect(none).toHaveLength(0);

        const found = await pdf.page(11).selectImagesAt(55, 310);
        expect(found).toHaveLength(1);
        expect(found[0].internalId).toBe('IMAGE_000003');
    });

    test('add image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const before = await pdf.selectImages();
        expect(before).toHaveLength(3);

        const result = await pdf.newImage()
            .fromFile(getImagePath('logo-80.png'))
            .at(6, 50.1, 98.0)
            .add();

        expect(result).toBeTruthy();

        const after = await pdf.selectImages();
        expect(after).toHaveLength(4);

        const page6Images = await pdf.page(6).selectImages();
        expect(page6Images).toHaveLength(1);

        const added = page6Images[0];
        expect(added.position.pageIndex).toBe(6);
        expect(added.internalId).toBe('IMAGE_000004');
        expectWithin(added.position.boundingRect?.x, 50.1, 0.05);
        expectWithin(added.position.boundingRect?.y, 98.0, 0.05);
    });
});
