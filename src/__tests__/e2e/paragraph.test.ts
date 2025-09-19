/**
 * E2E tests for paragraph operations
 */

import {ClientV1, Color, Font, Position} from '../../index';
import {readFontFixture, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from "../assertions";

describe('Paragraph E2E Tests', () => {
    // Tests should fail properly if environment is not configured

    test('find paragraphs by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const paras = await client.findParagraphs();
        expect(paras).toHaveLength(172);

        const parasPage0 = await client.findParagraphs(Position.atPage(0));
        expect(parasPage0).toHaveLength(2);

        const first = parasPage0[0];
        expect(first.internalId).toBe('PARAGRAPH_000003');
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1);
        expectWithin(first.position.boundingRect?.y, 706, 1);

        const last = parasPage0[parasPage0.length - 1];
        expect(last.internalId).toBe('PARAGRAPH_000004');
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 54, 1);
        expectWithin(last.position.boundingRect?.y, 496, 2);
    });

    test('find paragraphs by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const pos = Position.atPage(0);
        pos.textStartsWith = 'The Complete';
        const paras = await client.findParagraphs(pos);
        expect(paras).toHaveLength(1);

        const p = paras[0];
        expect(p.internalId).toBe('PARAGRAPH_000004');
        expect(p.position).toBeDefined();
        expectWithin(p.position.boundingRect?.x, 54, 1);
        expectWithin(p.position.boundingRect?.y, 496, 2);
    });

    test('delete paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const posDel = Position.atPage(0);
        posDel.textStartsWith = 'The Complete';
        const ref = (await client.findParagraphs(posDel))[0];
        expect(await client.delete(ref)).toBe(true);

        const posDel2 = Position.atPage(0);
        posDel2.textStartsWith = 'The Complete';
        expect(await client.findParagraphs(posDel2)).toHaveLength(0);
    });

    test('move paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const posMove = Position.atPage(0);
        posMove.textStartsWith = 'The Complete';
        const ref = (await client.findParagraphs(posMove))[0];
        const newPos = Position.atPageCoordinates(0, 0.1, 300);
        expect(await client.move(ref, newPos)).toBe(true);

        const ref2 = (await client.findParagraphs(newPos))[0];
        expect(ref2).toBeDefined();
    });

    async function assertNewParagraphExists(client: ClientV1): Promise<void> {
        // Validate via find_text_lines for text starting with 'Awesomely'
        const pos = Position.atPage(0);
        pos.textStartsWith = 'Awesomely';
        const lines = await client.findTextLines(pos);
        expect(lines.length).toBeGreaterThanOrEqual(1);
    }

    test('modify paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const posMod = Position.atPage(0);
        posMod.textStartsWith = 'The Complete';
        const ref = (await client.findParagraphs(posMod))[0];

        const newParagraph = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withFont(new Font('Helvetica', 14))
            .withLineSpacing(0.7)
            .withPosition(Position.atPageCoordinates(0, 300.1, 500))
            .build();

        expect(await client.modifyParagraph(ref, newParagraph)).toBe(true);
        await assertNewParagraphExists(client);
    });

    test('modify paragraph simple', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const posMod2 = Position.atPage(0);
        posMod2.textStartsWith = 'The Complete';
        const ref = (await client.findParagraphs(posMod2))[0];
        expect(await client.modifyParagraph(ref, 'Awesomely\\nObvious!')).toBe(true);
        await assertNewParagraphExists(client);
    });

    test('add paragraph with custom font - expect not found', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const pb = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withFont(new Font('Roboto', 14))
            .withLineSpacing(0.7)
            .withPosition(Position.atPageCoordinates(0, 300.1, 500));

        await expect(client.addParagraph(pb.build())).rejects.toThrow('Font not found');
    });

    test('add paragraph with custom font - Roboto-Regular', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const pb = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withFont(new Font('Roboto-Regular', 14))
            .withLineSpacing(0.7)
            .withPosition(Position.atPageCoordinates(0, 300.1, 500));

        expect(await client.addParagraph(pb.build())).toBe(true);
        await assertNewParagraphExists(client);
    });

    test('add paragraph with found font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const fonts = await client.findFonts('Roboto', 14);
        expect(fonts.length).toBeGreaterThan(0);
        expect(fonts[0].name).toBe('Roboto-Regular');

        const roboto = fonts[0];
        const pb = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withFont(roboto)
            .withLineSpacing(0.7)
            .withPosition(Position.atPageCoordinates(0, 300.1, 500));

        expect(await client.addParagraph(pb.build())).toBe(true);
        await assertNewParagraphExists(client);
    });

    test('add paragraph with Asimovian font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        const fonts = await client.findFonts('Asimovian', 14);
        expect(fonts.length).toBeGreaterThan(0);
        expect(fonts[0].name).toBe('Asimovian-Regular');

        const asimovian = fonts[0];
        const pb = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withFont(asimovian)
            .withLineSpacing(0.7)
            .withPosition(Position.atPageCoordinates(0, 300.1, 500));

        expect(await client.addParagraph(pb.build())).toBe(true);
        await assertNewParagraphExists(client);
    });

    test('add paragraph with custom TTF font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

        // Use DancingScript-Regular.ttf from fixtures directory
        const ttfData = readFontFixture('DancingScript-Regular.ttf');

        const pb = client.paragraphBuilder()
            .fromString('Awesomely\\nObvious!')
            .withLineSpacing(1.8)
            .withColor(new Color(0, 0, 255))
            .withPosition(Position.atPageCoordinates(0, 300.1, 500));

        await pb.withFontFile(ttfData, 24);

        expect(await client.addParagraph(pb.build())).toBe(true);
        await assertNewParagraphExists(client);
    });
});
