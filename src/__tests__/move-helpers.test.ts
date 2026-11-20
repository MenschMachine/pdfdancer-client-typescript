/**
 * Unit tests for moveTo / moveX / moveY on selectable objects (no server needed).
 */

import {ObjectRef, ObjectType, PathGroupInfo, Position, TextObjectRef} from '../models';
import {ImageObject, PathGroupObject, TextLineObject} from '../types';
import {PDFDancer} from '../pdfdancer_v2';
import {ValidationException} from '../exceptions';

function fakeClient(moved = true) {
    const move = jest.fn().mockResolvedValue(moved);
    const movePathGroup = jest.fn().mockResolvedValue(moved);
    return {client: {move, movePathGroup} as unknown as PDFDancer, move, movePathGroup};
}

function image(client: PDFDancer, x = 100, y = 200, page = 3) {
    return new ImageObject(client, 'IMAGE_1', ObjectType.IMAGE, Position.atPageCoordinates(page, x, y));
}

function sentPosition(move: jest.Mock, call = 0): Position {
    return move.mock.calls[call][1] as Position;
}

describe('moveTo / moveX / moveY', () => {
    test('moveTo sends the target with the object page', async () => {
        const {client, move} = fakeClient();

        await expect(image(client).moveTo(10, 20)).resolves.toBe(true);

        const sent = sentPosition(move);
        expect([sent.pageNumber, sent.getX(), sent.getY()]).toEqual([3, 10, 20]);
    });

    test('moveX is relative to the current position', async () => {
        const {client, move} = fakeClient();

        await image(client, 100, 200).moveX(5);

        const sent = sentPosition(move);
        expect([sent.getX(), sent.getY()]).toEqual([105, 200]);
    });

    test('moveY is relative to the current position', async () => {
        const {client, move} = fakeClient();

        await image(client, 100, 200).moveY(-15);

        const sent = sentPosition(move);
        expect([sent.getX(), sent.getY()]).toEqual([100, 185]);
    });

    test('successive relative moves compose', async () => {
        const {client, move} = fakeClient();
        const img = image(client, 100, 200);

        await img.moveX(20);
        await img.moveY(-15);

        const sent = sentPosition(move, 1);
        expect([sent.getX(), sent.getY()]).toEqual([120, 185]);
        expect([img.position.getX(), img.position.getY()]).toEqual([120, 185]);
    });

    test('a failed move keeps the local position', async () => {
        const {client} = fakeClient(false);
        const img = image(client, 100, 200);

        await expect(img.moveX(20)).resolves.toBe(false);

        expect([img.position.getX(), img.position.getY()]).toEqual([100, 200]);
    });

    test('a move does not mutate a position already handed out', async () => {
        const {client} = fakeClient();
        const img = image(client, 100, 200);
        const before = img.position;

        await img.moveX(20);

        expect([before.getX(), before.getY()]).toEqual([100, 200]);
        expect([img.position.getX(), img.position.getY()]).toEqual([120, 200]);
        expect(img.position.pageNumber).toBe(3);
    });

    test('moveX without a position throws', async () => {
        const {client, move} = fakeClient();
        const img = new ImageObject(client, 'IMAGE_1', ObjectType.IMAGE, Position.atPage(1));

        await expect(img.moveX(5)).rejects.toThrow(ValidationException);
        await expect(img.moveX(5)).rejects.toThrow('has no position');
        expect(move).not.toHaveBeenCalled();
    });
});

describe('TextLineObject', () => {
    test('exposes the text and moves', async () => {
        const {client, move} = fakeClient();
        const ref = new TextObjectRef('TEXT_LINE_1', Position.atPageCoordinates(1, 72, 700), ObjectType.TEXT_LINE, 'Hello');

        const line = TextLineObject.fromRef(client, ref);
        await line.moveX(10);

        expect(line.text).toBe('Hello');
        const sent = sentPosition(move);
        expect([sent.getX(), sent.getY()]).toEqual([82, 700]);
    });

    test('a plain ObjectRef has no text', () => {
        const {client} = fakeClient();
        const ref = new ObjectRef('TEXT_LINE_1', Position.atPage(1), ObjectType.TEXT_LINE);

        expect(TextLineObject.fromRef(client, ref).text).toBeUndefined();
    });
});

describe('PathGroupObject move', () => {
    function group(client: PDFDancer) {
        return new PathGroupObject(client, 0, new PathGroupInfo('g1', 2, null, 50, 60));
    }

    test('moveX and moveY compose', async () => {
        const {client, movePathGroup} = fakeClient();
        const g = group(client);

        await g.moveX(20);
        await g.moveY(-15);

        expect(movePathGroup.mock.calls[0]).toEqual([0, 'g1', 70, 60]);
        expect(movePathGroup.mock.calls[1]).toEqual([0, 'g1', 70, 45]);
        expect([g.x, g.y]).toEqual([70, 45]);
    });

    test('a failed move keeps the local position', async () => {
        const {client} = fakeClient(false);
        const g = group(client);

        await g.moveX(20);

        expect([g.x, g.y]).toEqual([50, 60]);
    });
});
