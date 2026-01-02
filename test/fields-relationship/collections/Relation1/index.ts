import type { CollectionConfig } from 'payload'

import { baseRelationshipFields } from '../../baseFields.js'
import { relationOneSlug } from '../../slugs.js'

export const Relation1: CollectionConfig = {
  slug: relationOneSlug,
  defaultPopulate: {
    name: true,
    // Excludes 'number' and 'title'
  },
  fields: baseRelationshipFields,
}
