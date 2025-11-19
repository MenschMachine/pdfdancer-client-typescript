import {ObjectType, Orientation, PDFDancer, STANDARD_PAGE_SIZES} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Page E2E Tests (Showcase)', () => {
    test('get all elements', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const elements = await pdf.selectElements();
        expect(elements.length).toBe(95);

        let total = 0;
        for (const page of await pdf.pages()) {
            const pageElements = await page.selectElements();
            total += pageElements.length;
        }
        expect(total).toBe(95);
    });

    test('get pages', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pages = await pdf.pages();
        expect(pages).toBeDefined();
        expect(pages.length).toBe(7);
        expect(pages[0].type).toBe(ObjectType.PAGE);
    });

    test('get page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const page = pdf.page(2);
        expect(page).toBeDefined();
        expect(page.position.pageIndex).toBe(2);
        expect(page.internalId).toBeDefined();
    });

    test('delete page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const page3 = pdf.page(3);
        await page3.delete();

        const pagesAfter = await pdf.pages();
        expect(pagesAfter.length).toBe(6);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPages(6);
    });

    test('move page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pagesBefore = await pdf.pages();
        expect(pagesBefore.length).toBe(7);

        const result = await pdf.movePage(0, 6);
        expect(result.position.pageIndex).toBe(6);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('This is regular Sans text showing alignment and styles.', 6);
    });

    test('add page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pagesBefore = await pdf.pages();
        expect(pagesBefore.length).toBe(7);

        await pdf.newPage().add();

        const pagesAfter = await pdf.pages();
        expect(pagesAfter.length).toBe(8);
        expect(pagesAfter[7].position.pageIndex).toBe(7);
        expect(pagesAfter[7].internalId).toBeDefined();
    });

    test('add page with builder default', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().add();
        expect(pageRef.position.pageIndex).toBe(7);
        expect((await pdf.pages()).length).toBe(8);
    });

    test('add page with builder A4 portrait', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().a4().portrait().add();
        expect(pageRef.position.pageIndex).toBe(7);
        expect((await pdf.pages()).length).toBe(8);
    });

    test('add page with builder letter landscape', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().letter().landscape().add();
        expect(pageRef.position.pageIndex).toBe(7);
        expect((await pdf.pages()).length).toBe(8);
    });

    test('add page with builder at index', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().atIndex(5).a5().landscape().add();
        expect(pageRef.position.pageIndex).toBe(5);
        expect((await pdf.pages()).length).toBe(8);

        const assertions = await PDFAssertions.create(pdf);
        const a5 = STANDARD_PAGE_SIZES.A5;
        await assertions.assertPageDimension(a5.width, a5.height, Orientation.PORTRAIT, 5);
        await assertions.assertTotalNumberOfElements(0, 5);
    });

    test('add page with builder custom size', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().customSize(400, 600).landscape().add();
        expect(pageRef.position.pageIndex).toBe(7);
        expect((await pdf.pages()).length).toBe(8);
    });

    test('add page with builder all options', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        expect((await pdf.pages()).length).toBe(7);

        const pageRef = await pdf.newPage().atIndex(3).pageSize('A3').orientation(Orientation.LANDSCAPE).add();
        expect(pageRef.position.pageIndex).toBe(3);
        expect((await pdf.pages()).length).toBe(8);
    });
});
