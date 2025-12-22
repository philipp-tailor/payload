import type { DeepPartial } from 'ts-essentials'

import type { CollectionSlug } from '../../index.js'
import type { TransformCollectionWithSelect } from '../../types/index.js'
import type { RequiredDataFromCollectionSlug, SelectFromCollectionSlug } from '../config/types.js'

import { type Arguments as CreateArguments, createOperation } from './create.js'

export type Arguments<TSlug extends CollectionSlug> = {
  data?: DeepPartial<RequiredDataFromCollectionSlug<TSlug>>
  id: number | string
  /**
   * Optional identifier field name to use for lookup instead of 'id'.
   * When provided, the query will use this field for document lookup.
   */
  identifierField?: string
} & Omit<CreateArguments<TSlug>, 'data' | 'duplicateFromID' | 'duplicateFromIdentifierField'>

export const duplicateOperation = async <
  TSlug extends CollectionSlug,
  TSelect extends SelectFromCollectionSlug<TSlug>,
>(
  incomingArgs: Arguments<TSlug>,
): Promise<TransformCollectionWithSelect<TSlug, TSelect>> => {
  const { id, identifierField, ...args } = incomingArgs
  return createOperation({
    ...args,
    data: incomingArgs?.data || {},
    duplicateFromID: id,
    duplicateFromIdentifierField: identifierField,
  })
}
