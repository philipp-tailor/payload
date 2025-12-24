import type { CollectionConfig } from 'payload'

export const RelationWithPopulate: CollectionConfig = {
  slug: 'relation-with-populate',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'relationDefault',
      type: 'relationship',
      relationTo: 'relation-one',
      // No populate - should use collection defaultPopulate
    },
    {
      name: 'relationWithPopulate',
      type: 'relationship',
      populate: {
        number: true,
        title: true,
      },
      relationTo: 'relation-one',
    },
    {
      name: 'relationPolymorphic',
      type: 'relationship',
      populate: {
        title: true,
      },
      relationTo: ['relation-one', 'relation-two'],
    },
  ],
}
