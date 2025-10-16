/**
 * E2E tests for AcroForm field operations
 */

import * as fs from 'fs';
import {PDFDancer, FormFieldRef, ObjectType, Position} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('AcroForm Fields E2E Tests', () => {
    test('find form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const client = await PDFDancer.open(token, pdfData, baseUrl);

        const formFields = await client.findFormFields();
        expect(formFields).toHaveLength(10);
        expect(formFields[0].type).toBe(ObjectType.TEXT_FIELD);
        expect(formFields[4].type).toBe(ObjectType.CHECK_BOX);
        expect(formFields[6].type).toBe(ObjectType.RADIO_BUTTON);

        let allFormsAtOrigin = true;
        for (const form of formFields) {
            const pos = form.position;
            if ((pos.getX() ?? 0) !== 0.0 || (pos.getY() ?? 0) !== 0.0) {
                allFormsAtOrigin = false;
            }
        }
        expect(allFormsAtOrigin).toBe(false); // "All forms should not be at coordinates (0,0)"

        const firstPageFields = await client.findFormFields(Position.atPage(0));
        expect(firstPageFields).toHaveLength(10);

        const firstForm = await client.findFormFields(Position.atPageCoordinates(0, 290, 460));
        expect(firstForm).toHaveLength(1);
        expect(firstForm[0].type).toBe(ObjectType.RADIO_BUTTON);
        expect(firstForm[0].internalId).toBe("FORM_FIELD_000008");
    });

    test('delete form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const client = await PDFDancer.open(token, pdfData, baseUrl);

        const formFields = await client.findFormFields();
        expect(formFields).toHaveLength(10);
        const objectRefToDelete = formFields[5];
        await client.delete(objectRefToDelete);
        const allFormFields = await client.findFormFields();
        expect(allFormFields).toHaveLength(9);
        for (const fieldRef of allFormFields) {
            expect(fieldRef.internalId).not.toBe(objectRefToDelete.internalId);
        }
    });

    test('move form field', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const client = await PDFDancer.open(token, pdfData, baseUrl);

        let formFields = await client.findFormFields(Position.atPageCoordinates(0, 290, 460));
        expect(formFields).toHaveLength(1);
        const objectRef = formFields[0];
        expect(Math.abs((objectRef.position.getX() ?? 0) - 280)).toBeLessThan(0.1);
        expect(Math.abs((objectRef.position.getY() ?? 0) - 455)).toBeLessThan(0.1);

        await client.move(objectRef, Position.atPageCoordinates(0, 30, 40));

        formFields = await client.findFormFields(Position.atPageCoordinates(0, 290, 460));
        expect(formFields).toHaveLength(0);

        formFields = await client.findFormFields(Position.atPageCoordinates(0, 30, 40));
        expect(formFields).toHaveLength(1);
        expect(formFields[0].internalId).toBe(objectRef.internalId);
    });

    test('edit form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const client = await PDFDancer.open(token, pdfData, baseUrl);

        let formFields = await client.findFormFields(Position.byName("firstName"));
        expect(formFields).toHaveLength(1);
        let objectRef = formFields[0];
        expect(objectRef.name).toBe("firstName");
        expect(objectRef.value).toBeNull();
        expect(objectRef.type).toBe(ObjectType.TEXT_FIELD);
        expect(objectRef.internalId).toBe("FORM_FIELD_000001");

        expect(await client.changeFormField(objectRef, "Donald Duck")).toBe(true);

        formFields = await client.findFormFields(Position.byName("firstName"));
        objectRef = formFields[0];
        expect(objectRef.name).toBe("firstName");
        expect(objectRef.value).toBe("Donald Duck");
    });
});
