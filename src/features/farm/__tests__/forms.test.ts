import {
  emptySpaceForm,
  emptyZoneForm,
  fieldErrors,
  spaceFormSchema,
  spaceToForm,
  zoneFormSchema,
  zoneToForm,
} from '../forms';

const m = { required: 'req', positive: 'pos' };

describe('zone form', () => {
  it('maps empty optional fields to null and drops the unit without an area', () => {
    const r = zoneFormSchema(m).parse({
      ...emptyZoneForm(),
      name: ' Coconut area ',
    });
    expect(r).toEqual({
      name: 'Coconut area',
      zoneType: 'COCONUT_AREA',
      description: null,
      area: null,
      areaUnit: null,
    });
  });

  it('keeps area + unit together', () => {
    const r = zoneFormSchema(m).parse({
      ...emptyZoneForm(),
      name: 'A',
      area: '0.5',
      areaUnit: 'ACRE',
    });
    expect(r).toMatchObject({ area: 0.5, areaUnit: 'ACRE' });
  });

  it('reports field errors', () => {
    const r = zoneFormSchema(m).safeParse({
      ...emptyZoneForm(),
      name: '',
      area: '-1',
    });
    expect(r.success).toBe(false);
    expect(!r.success && fieldErrors(r.error.issues)).toEqual({
      name: 'req',
      area: 'pos',
    });
  });

  it('round-trips an existing zone', () => {
    const form = zoneToForm({
      id: 'z',
      tenantId: 't',
      farmId: 'f',
      name: 'Polytunnel',
      zoneType: 'POLYTUNNEL',
      area: 200,
      areaUnit: 'SQ_M',
      status: 'ACTIVE',
      version: 3,
    });
    expect(form).toMatchObject({
      name: 'Polytunnel',
      area: '200',
      areaUnit: 'SQ_M',
      description: '',
    });
  });
});

describe('space form', () => {
  it('parses dimensions and leaves unset conditions null', () => {
    const r = spaceFormSchema(m).parse({
      ...emptySpaceForm(),
      name: 'Back strip',
      spaceType: 'NARROW_STRIP',
      width: '1.2',
      length: '8',
      shadeLevel: 'MEDIUM',
    });
    expect(r).toMatchObject({
      width: 1.2,
      length: 8,
      shadeLevel: 'MEDIUM',
      sunlightLevel: null,
      parentZoneId: null,
    });
  });

  it('rejects unknown condition values', () => {
    expect(
      spaceFormSchema(m).safeParse({
        ...emptySpaceForm(),
        name: 'x',
        drainage: 'SWAMPY',
      }).success
    ).toBe(false);
  });

  it('round-trips nulls to empty strings', () => {
    const f = spaceToForm({
      id: 's',
      tenantId: 't',
      farmId: 'f',
      name: 'Bed 1',
      spaceType: 'BED',
      width: null,
      status: 'UNUSED',
      version: 1,
    });
    expect(f).toMatchObject({ width: '', parentZoneId: '', waterAccess: '' });
  });
});
