/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { get } from 'lodash/fp';

import { ApplySiemFilterAction, getExpressionFromArray } from './apply_siem_filter_action';
// @ts-ignore Missing type defs as maps moves to Typescript
import { MAP_SAVED_OBJECT_TYPE } from '../../../../../maps/common/constants';
import { Action } from '../../../../../../../../src/legacy/core_plugins/embeddable_api/public/np_ready/public/lib/actions';
import { expectError } from '../../../../../../../../src/legacy/core_plugins/embeddable_api/public/np_ready/public/tests/helpers';
import {
  EmbeddableInput,
  EmbeddableOutput,
  IEmbeddable,
} from '../../../../../../../../src/legacy/core_plugins/embeddable_api/public/np_ready/public/lib/embeddables';
import { Filter } from '@kbn/es-query';

// Using type narrowing to remove all the any's -- https://github.com/elastic/kibana/pull/43965/files#r318796100
const isEmbeddable = (
  embeddable: unknown
): embeddable is IEmbeddable<EmbeddableInput, EmbeddableOutput> => {
  return get('type', embeddable) != null;
};

const isTriggerContext = (triggerContext: unknown): triggerContext is { filters: Filter[] } => {
  return typeof triggerContext === 'object';
};

describe('ApplySiemFilterAction', () => {
  let applyFilterQueryFromKueryExpression: (expression: string) => void;

  beforeEach(() => {
    applyFilterQueryFromKueryExpression = jest.fn(expression => {});
  });

  test('it is an instance of Action', () => {
    const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
    expect(action).toBeInstanceOf(Action);
  });

  test('it has APPLY_SIEM_FILTER_ACTION_ID type and id', () => {
    const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
    expect(action.id).toBe('APPLY_SIEM_FILTER_ACTION_ID');
    expect(action.type).toBe('APPLY_SIEM_FILTER_ACTION_ID');
  });

  test('it has expected display name', () => {
    const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
    expect(action.getDisplayName()).toMatchInlineSnapshot(`"Apply filter"`);
  });

  describe('#isCompatible', () => {
    test('when embeddable type is MAP_SAVED_OBJECT_TYPE and triggerContext filters exist, returns true', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: MAP_SAVED_OBJECT_TYPE,
      };
      if (isEmbeddable(embeddable)) {
        const result = await action.isCompatible({
          embeddable,
          triggerContext: {
            filters: [],
          },
        });
        expect(result).toBe(true);
      } else {
        throw new Error('Invalid embeddable in unit test');
      }
    });

    test('when embeddable type is MAP_SAVED_OBJECT_TYPE and triggerContext does not exist, returns false', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: MAP_SAVED_OBJECT_TYPE,
      };
      if (isEmbeddable(embeddable)) {
        const result = await action.isCompatible({
          embeddable,
        });
        expect(result).toBe(false);
      } else {
        throw new Error('Invalid embeddable in unit test');
      }
    });

    test('when embeddable type is MAP_SAVED_OBJECT_TYPE and triggerContext filters do not exist, returns false', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: MAP_SAVED_OBJECT_TYPE,
      };
      const triggerContext = {};
      if (isEmbeddable(embeddable) && isTriggerContext(triggerContext)) {
        const result = await action.isCompatible({
          embeddable,
          triggerContext,
        });
        expect(result).toBe(false);
      } else {
        throw new Error('Invalid embeddable/triggerContext in unit test');
      }
    });

    test('when embeddable type is not MAP_SAVED_OBJECT_TYPE, returns false', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: 'defaultEmbeddable',
      };
      if (isEmbeddable(embeddable)) {
        const result = await action.isCompatible({
          embeddable,
          triggerContext: {
            filters: [],
          },
        });
        expect(result).toBe(false);
      } else {
        throw new Error('Invalid embeddable in unit test');
      }
    });
  });

  describe('#execute', () => {
    test('it throws an error when triggerContext not set', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: MAP_SAVED_OBJECT_TYPE,
      };
      if (isEmbeddable(embeddable)) {
        const error = expectError(() =>
          action.execute({
            embeddable,
          })
        );
        expect(error).toBeInstanceOf(Error);
      } else {
        throw new Error('Invalid embeddable in unit test');
      }
    });

    test('it calls applyFilterQueryFromKueryExpression() with valid expression', async () => {
      const action = new ApplySiemFilterAction({ applyFilterQueryFromKueryExpression });
      const embeddable = {
        type: MAP_SAVED_OBJECT_TYPE,
        getInput: () => ({
          query: { query: '' },
        }),
      };
      const triggerContext = {
        filters: [
          {
            query: {
              match: {
                'host.name': {
                  query: 'zeek-newyork-sha-aa8df15',
                  type: 'phrase',
                },
              },
            },
          },
        ],
      };
      if (isEmbeddable(embeddable) && isTriggerContext(triggerContext)) {
        await action.execute({
          embeddable,
          triggerContext,
        });

        expect(
          (applyFilterQueryFromKueryExpression as jest.Mock<(expression: string) => void>).mock
            .calls[0][0]
        ).toBe('host.name: "zeek-newyork-sha-aa8df15"');
      } else {
        throw new Error('Invalid embeddable/triggerContext in unit test');
      }
    });
  });
});

describe('#getExpressionFromArray', () => {
  test('it returns an empty expression if no filterValues are provided', () => {
    const layerList = getExpressionFromArray('host.id', []);
    expect(layerList).toEqual('');
  });

  test('it returns a valid expression when provided multiple filterValues', () => {
    const layerList = getExpressionFromArray('host.id', ['xavier', 'angela', 'frank']);
    expect(layerList).toEqual('(host.id: "xavier" OR host.id: "angela" OR host.id: "frank")');
  });
});
