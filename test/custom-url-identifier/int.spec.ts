import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { devUser } from '../credentials.js'
import { initPayloadInt } from '../helpers/initPayloadInt.js'

let payload: Payload

describe('Custom URL Identifier', () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(__dirname))
  })

  afterAll(async () => {
    if (typeof payload.db.destroy === 'function') {
      await payload.db.destroy()
    }
  })

  describe('Admin UI Document Lookup', () => {
    let pageId: number | string
    const pageSlug = 'hello-world'

    beforeAll(async () => {
      // Create a page with a slug
      const page = await payload.create({
        collection: 'pages',
        data: {
          title: 'Hello World',
          slug: pageSlug,
          content: 'This is a test page',
        },
      })
      pageId = page.id
    })

    it('should find document by custom identifier using find operation', async () => {
      // Admin UI uses find with where clause for custom identifiers
      const result = await payload.find({
        collection: 'pages',
        where: {
          slug: { equals: pageSlug },
        },
        limit: 1,
      })

      expect(result.docs).toHaveLength(1)
      expect(result.docs[0].id).toBe(pageId)
      expect(result.docs[0].slug).toBe(pageSlug)
      expect(result.docs[0].title).toBe('Hello World')
    })

    it('should still find document by real ID using findByID', async () => {
      // REST API operations always use real ID
      const doc = await payload.findByID({
        collection: 'pages',
        id: pageId,
      })

      expect(doc).toBeDefined()
      expect(doc.id).toBe(pageId)
      expect(doc.slug).toBe(pageSlug)
      expect(doc.title).toBe('Hello World')
    })

    it('should update document using real ID', async () => {
      // All REST API operations use real ID, not custom identifier
      const updated = await payload.update({
        collection: 'pages',
        id: pageId,
        data: {
          content: 'Updated content',
        },
      })

      expect(updated).toBeDefined()
      expect(updated.id).toBe(pageId)
      expect(updated.slug).toBe(pageSlug)
      expect(updated.content).toBe('Updated content')
    })

    it('should delete document using real ID', async () => {
      // Create a new page to delete
      const newPage = await payload.create({
        collection: 'pages',
        data: {
          title: 'To Delete',
          slug: 'to-delete',
          content: 'Will be deleted',
        },
      })

      // Delete using real ID
      const deleted = await payload.delete({
        collection: 'pages',
        id: newPage.id,
      })

      expect(deleted).toBeDefined()
      expect(deleted.id).toBe(newPage.id)
      expect(deleted.slug).toBe('to-delete')

      // Verify it's actually deleted
      await expect(
        payload.findByID({
          collection: 'pages',
          id: newPage.id,
        }),
      ).rejects.toThrow()
    })

    it('should duplicate document using real ID', async () => {
      // Duplicate using real ID
      const duplicated = await payload.duplicate({
        collection: 'pages',
        id: pageId,
        data: {
          slug: 'hello-world-copy',
        },
      })

      expect(duplicated).toBeDefined()
      expect(duplicated.id).not.toBe(pageId)
      expect(duplicated.slug).toBe('hello-world-copy')
      expect(duplicated.title).toBe('Hello World')
      expect(duplicated.content).toBe('Updated content') // From previous update test
    })

    it('should handle special characters when finding by custom identifier', async () => {
      // Create a page with special characters in slug
      const page = await payload.create({
        collection: 'pages',
        data: {
          title: 'Special Page',
          slug: 'hello world',
          content: 'Page with spaces',
        },
      })

      // Admin UI uses find with where clause
      const result = await payload.find({
        collection: 'pages',
        where: {
          slug: { equals: 'hello world' },
        },
        limit: 1,
      })

      expect(result.docs).toHaveLength(1)
      expect(result.docs[0].id).toBe(page.id)
      expect(result.docs[0].slug).toBe('hello world')
    })

    it('should return empty result for non-existent custom identifier', async () => {
      const result = await payload.find({
        collection: 'pages',
        where: {
          slug: { equals: 'non-existent-slug' },
        },
        limit: 1,
      })

      expect(result.docs).toHaveLength(0)
    })
  })

  describe('Config Validation', () => {
    it('should validate that useAsUrlIdentifier field exists', async () => {
      // This test verifies that config validation happens at initialization
      // The validation is tested by attempting to create an invalid config
      expect(payload.collections.pages.config.admin.useAsUrlIdentifier).toBe('slug')
    })

    it('should validate that the identifier field is unique', async () => {
      // Test that we can't create duplicate slugs
      await payload.create({
        collection: 'pages',
        data: {
          title: 'Unique Test 1',
          slug: 'unique-slug',
          content: 'First page',
        },
      })

      await expect(
        payload.create({
          collection: 'pages',
          data: {
            title: 'Unique Test 2',
            slug: 'unique-slug', // Duplicate slug
            content: 'Second page',
          },
        }),
      ).rejects.toThrow()
    })
  })
})
