import type { CollectionConfig } from 'payload'

export const baseRelationshipFields: CollectionConfig['fields'] = [
  {
    name: 'name',
    type: 'text',
  },
  {
    name: 'title',
    type: 'text',
  },
  {
    name: 'number',
    type: 'number',
  },
]
