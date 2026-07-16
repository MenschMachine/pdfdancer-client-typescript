import {
    AddRequest,
    DeleteRequest,
    FindRequest,
    Image,
    MoveRequest,
    ObjectRef,
    ObjectType,
    Position,
    PositionMode,
    ShapeType
} from '../models';
import {VERSION} from '../version';

describe('model exposure and serialization', () => {
    test('package version is publicly exposed as a non-empty string', () => {
        expect(typeof VERSION).toBe('string');
        expect(VERSION.length).toBeGreaterThan(0);
    });

    test('ObjectType contains every public object category', () => {
        expect(new Set(Object.values(ObjectType))).toEqual(new Set([
            'PDF', 'PAGE', 'TEXT_ELEMENT', 'IMAGE', 'PATH', 'LINE', 'RECTANGLE', 'BEZIER',
            'CLIPPING', 'FORM_X_OBJECT', 'FORM_FIELD', 'WORD', 'TEXT_LINE', 'TEXT_FIELD',
            'RADIO_BUTTON', 'BUTTON', 'DROPDOWN', 'CHECKBOX'
        ]));
    });

    test('position factories and movement expose equivalent coordinates', () => {
        const page = Position.atPage(2);
        expect(page.pageNumber).toBe(2);
        expect(page.mode).toBe(PositionMode.CONTAINS);
        expect(page.boundingRect).toBeUndefined();

        const point = Position.atPageCoordinates(1, 100.5, 200.75);
        expect(point.shape).toBe(ShapeType.POINT);
        point.moveX(25).moveY(-50);
        expect(point.getX()).toBe(125.5);
        expect(point.getY()).toBe(150.75);
    });

    test('request wrappers use the v2 field names', () => {
        const position = Position.atPageCoordinates(1, 10, 20);
        const ref = new ObjectRef('test-id', position, ObjectType.IMAGE);

        expect(new FindRequest(ObjectType.IMAGE, position, 'hint').toDict()).toEqual({
            objectType: 'IMAGE', position: expect.any(Object), hint: 'hint'
        });
        expect(new DeleteRequest(ref).toDict()).toEqual({objectRef: {
            internalId: 'test-id', position: expect.any(Object), type: 'IMAGE'
        }});
        expect(new MoveRequest(ref, Position.atPageCoordinates(2, 50, 60)).toDict())
            .toEqual({objectRef: {
                internalId: 'test-id', position: expect.any(Object), type: 'IMAGE'
            }, newPosition: expect.any(Object)});
        expect(new AddRequest(new Image(position, 'PNG', 1, 1, new Uint8Array([1]))).toDict())
            .toMatchObject({object: {type: 'IMAGE', position: expect.any(Object)}});
    });
});
