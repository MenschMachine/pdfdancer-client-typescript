import fs from 'fs';
import {ObjectType, PDFDancer} from '../../index';
import {getImagePath, requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Image E2E Tests (Showcase)', () => {
    test('find images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        expect(images.length).toBe(12);
        expect(images[0].type).toBe(ObjectType.IMAGE);

        const pageImages = await pdf.page(1).selectImages();
        expect(pageImages.length).toBe(2);
    });

    test('delete all images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        expect(images.length).toBe(12);
        for (const image of images) {
            await image.delete();
        }

        expect(await pdf.selectImages()).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        for (const page of await pdf.pages()) {
            await assertions.assertNumberOfImages(0, page.position.pageNumber ?? 1);
        }
    });

    test('move image', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.selectImages();
        const image = images[10];
        const position = image.position;
        const originalX = position.getX()!;
        const originalY = position.getY()!;
        expect(position.pageNumber).toBe(6);

        const newX = 500.1;
        const newY = 600.1;
        await image.moveTo(newX, newY);

        const moved = (await pdf.page(6).selectImagesAt(newX, newY))[0];
        expect(moved.position).toBeDefined();
        expect(Math.abs(moved.position.getX()! - newX)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(moved.position.getY()! - newY)).toBeLessThanOrEqual(0.05);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(newX, newY, 6);
        await assertions.assertNoImageAt(originalX, originalY, 6);
    });

    test('find image by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const none = await pdf.page(6).selectImagesAt(0, 0);
        expect(none.length).toBe(0);

        const found = await pdf.page(6).selectImagesAt(57, 55, 1);
        expect(found.length).toBe(1);
        expect(found[0].internalId).toBe('IMAGE_000011');
    });

    test('add image via document builder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect(await pdf.selectImages()).toHaveLength(12);
        expect(await pdf.page(6).selectImages()).toHaveLength(1);

        const fixturePath = getImagePath('logo-80.png');
        expect(fs.existsSync(fixturePath)).toBe(true);

        await pdf.newImage()
            .fromFile(fixturePath)
            .at(6, 50.1, 98.0)
            .add();

        expect(await pdf.selectImages()).toHaveLength(13);
        const pageImages = await pdf.page(6).selectImages();
        expect(pageImages.length).toBe(2);

        const added = pageImages[1];
        expect(added.position.pageNumber).toBe(6);
        expect(added.internalId).toBe('IMAGE_000013');
        expect(Math.abs(added.position.getX()! - 50.1)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(added.position.getY()! - 98.0)).toBeLessThanOrEqual(0.05);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(50.1, 98, 6);
        await assertions.assertNumberOfImages(2, 6);
    });

    test('add image via page builder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect(await pdf.selectImages()).toHaveLength(12);
        expect(await pdf.page(6).selectImages()).toHaveLength(1);

        const fixturePath = getImagePath('logo-80.png');
        expect(fs.existsSync(fixturePath)).toBe(true);

        await pdf.page(6).newImage()
            .fromFile(fixturePath)
            .at(50.1, 98.0)
            .add();

        expect(await pdf.selectImages()).toHaveLength(13);
        const pageImages = await pdf.page(6).selectImages();
        expect(pageImages.length).toBe(2);

        const added = pageImages[1];
        expect(added.position.pageNumber).toBe(6);
        expect(added.internalId).toBe('IMAGE_000013');
        expect(Math.abs(added.position.getX()! - 50.1)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(added.position.getY()! - 98.0)).toBeLessThanOrEqual(0.05);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertImageAt(50.1, 98, 6);
        await assertions.assertNumberOfImages(2, 6);
    });
});
