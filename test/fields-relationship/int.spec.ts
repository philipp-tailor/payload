import type { Payload } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { NextRESTClient } from '../helpers/NextRESTClient.js'
import type { Collection1 } from './payload-types.js'

import { devUser } from '../credentials.js'
import { initPayloadInt } from '../helpers/initPayloadInt.js'
import {
  collection1Slug,
  relationOneSlug,
  relationTwoSlug,
  relationWithPopulateSlug,
  versionedRelationshipFieldSlug,
} from './slugs.js'

let payload: Payload
let restClient: NextRESTClient

const { email, password } = devUser

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

describe('Relationship Fields', () => {
  beforeAll(async () => {
    const initialized = await initPayloadInt(dirname)
    ;({ payload, restClient } = initialized)

    await restClient.login({
      slug: 'users',
      credentials: {
        email,
        password,
      },
    })
  })

  afterAll(async () => {
    await payload.destroy()
  })

  describe('Versioned Relationship Field', () => {
    let version2ID: string
    const relatedDocName = 'Related Doc'
    beforeAll(async () => {
      const relatedDoc = await payload.create({
        collection: collection1Slug,
        data: {
          name: relatedDocName,
        },
      })

      const version1 = await payload.create({
        collection: versionedRelationshipFieldSlug,
        data: {
          title: 'Version 1 Title',
          relationshipField: {
            value: relatedDoc.id,
            relationTo: collection1Slug,
          },
        },
      })

      const version2 = await payload.update({
        collection: versionedRelationshipFieldSlug,
        id: version1.id,
        data: {
          title: 'Version 2 Title',
        },
      })

      const versions = await payload.findVersions({
        collection: versionedRelationshipFieldSlug,
        where: {
          parent: {
            equals: version2.id,
          },
        },
        sort: '-updatedAt',
        limit: 1,
      })

      version2ID = versions.docs[0].id
    })
    it('should return the correct versioned relationship field via REST', async () => {
      const version2Data = await restClient
        .GET(`/${versionedRelationshipFieldSlug}/versions/${version2ID}?locale=all`)
        .then((res) => res.json())

      expect(version2Data.version.title).toEqual('Version 2 Title')
      expect(version2Data.version.relationshipField[0].value.name).toEqual(relatedDocName)
    })

    it('should return the correct versioned relationship field via LocalAPI', async () => {
      const version2Data = await payload.findVersionByID({
        collection: versionedRelationshipFieldSlug,
        id: version2ID,
        locale: 'all',
      })

      expect(version2Data.version.title).toEqual('Version 2 Title')
      expect((version2Data.version.relationshipField[0].value as Collection1).name).toEqual(
        relatedDocName,
      )
    })
  })

  describe('Field-level populate', () => {
    let docWithRelations: any
    let relatedDocA: any
    let relatedDocB: any

    beforeAll(async () => {
      // Create a related document
      relatedDocA = await payload.create({
        collection: relationOneSlug,
        data: {
          title: 'Related A Title',
          number: 42,
          name: 'Related A Name',
        },
      })

      // Create relation-two document
      relatedDocB = await payload.create({
        collection: relationTwoSlug,
        data: {
          title: 'Related B Title',
          name: 'Related B Name',
          number: 99,
        },
      })

      // Create document with relationships
      docWithRelations = await payload.create({
        collection: relationWithPopulateSlug,
        data: {
          title: 'Main Doc',
          description: 'Test doc',
          relationWithPopulate: relatedDocA.id,
        },
      })

      // Update doc with polymorphic relations
      docWithRelations = await payload.update({
        collection: relationWithPopulateSlug,
        id: docWithRelations.id,
        data: {
          relationPolymorphic: [
            { relationTo: relationOneSlug, value: relatedDocA.id },
            { relationTo: relationTwoSlug, value: relatedDocB.id },
          ],
        },
      })
    })

    it('should use field-level populate when configured', async () => {
      const doc = await payload.findByID({
        collection: relationWithPopulateSlug,
        id: docWithRelations.id,
        depth: 1,
      })

      expect(doc.relationWithPopulate).toBeDefined()
      expect(typeof doc.relationWithPopulate).toBe('object')

      const populated = doc.relationWithPopulate

      // Should have fields specified in populate
      expect(populated.title).toBe('Related A Title')
      expect(populated.number).toBe(42)

      // Should NOT have fields not in populate (name is not in populate config)
      expect(populated.name).toBeUndefined()
    })

    it('should override collection defaultPopulate', async () => {
      // Relation1 has defaultPopulate: { name: true }
      // But field has populate: { title: true, number: true }

      const doc = await payload.findByID({
        collection: relationWithPopulateSlug,
        id: docWithRelations.id,
        depth: 1,
      })

      const populated = doc.relationWithPopulate

      // Should have field-level populate fields
      expect(populated.title).toBe('Related A Title')
      expect(populated.number).toBe(42)

      // Should NOT have defaultPopulate fields that aren't in field populate
      expect(populated.name).toBeUndefined()
    })

    it('should allow query-level populate to override field-level', async () => {
      // Field has populate: { title: true, number: true }
      // Query specifies different populate

      const doc = await payload.findByID({
        collection: relationWithPopulateSlug,
        id: docWithRelations.id,
        depth: 1,
        populate: {
          [relationOneSlug]: {
            name: true,
            // Excludes 'number' and 'title' that field-level includes
          },
        },
      })

      const populated = doc.relationWithPopulate

      // Should have query-level populate fields
      expect(populated.name).toBe('Related A Name')

      // Should NOT have field-level populate fields excluded by query
      expect(populated.title).toBeUndefined()
      expect(populated.number).toBeUndefined()
    })

    it('should apply same populate to all collections in polymorphic relationship', async () => {
      const doc = await payload.findByID({
        collection: relationWithPopulateSlug,
        id: docWithRelations.id,
        depth: 1,
      })

      expect(Array.isArray(doc.relationPolymorphic)).toBe(true)
      expect(doc.relationPolymorphic).toHaveLength(2)

      // Both populated docs should have title (from field populate)
      const populatedA = doc.relationPolymorphic.find((r) => r.relationTo === relationOneSlug)
      const populatedB = doc.relationPolymorphic.find((r) => r.relationTo === relationTwoSlug)

      expect(populatedA.value.title).toBe('Related A Title')
      expect(populatedB.value.title).toBe('Related B Title')

      // Should not have other fields (field only specifies title)
      expect(populatedA.value.number).toBeUndefined()
      expect(populatedA.value.name).toBeUndefined()
    })

    it('should use collection defaultPopulate when field has no populate config', async () => {
      // Create doc with relationDefault (no field-level populate)
      const doc = await payload.create({
        collection: relationWithPopulateSlug,
        data: {
          title: 'Default Test',
          relationDefault: relatedDocA.id,
        },
      })

      const fetched = await payload.findByID({
        collection: relationWithPopulateSlug,
        id: doc.id,
        depth: 1,
      })

      const populated = fetched.relationDefault

      // Should use collection defaultPopulate (name)
      expect(populated.name).toBe('Related A Name')
      // number and title not in defaultPopulate
      expect(populated.number).toBeUndefined()
      expect(populated.title).toBeUndefined()
    })
  })
})
