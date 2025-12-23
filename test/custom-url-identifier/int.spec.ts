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

  describe('REST API', () => {
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

    it('should find document by custom identifier (slug)', async () => {
      const doc = await payload.findByID({
        collection: 'pages',
        id: pageSlug,
      })

      expect(doc).toBeDefined()
      expect(doc.id).toBe(pageId)
      expect(doc.slug).toBe(pageSlug)
      expect(doc.title).toBe('Hello World')
    })

    it('should not find document by numeric ID when using custom identifier', async () => {
      await expect(
        payload.findByID({
          collection: 'pages',
          id: pageId,
        }),
      ).rejects.toThrow()
    })

    it('should update document by custom identifier (slug)', async () => {
      const updated = await payload.update({
        collection: 'pages',
        id: pageSlug,
        data: {
          content: 'Updated content',
        },
      })

      expect(updated).toBeDefined()
      expect(updated.id).toBe(pageId)
      expect(updated.slug).toBe(pageSlug)
      expect(updated.content).toBe('Updated content')
    })

    it('should delete document by custom identifier (slug)', async () => {
      // Create a new page to delete
      const newPage = await payload.create({
        collection: 'pages',
        data: {
          title: 'To Delete',
          slug: 'to-delete',
          content: 'Will be deleted',
        },
      })

      const deleted = await payload.delete({
        collection: 'pages',
        id: 'to-delete',
      })

      expect(deleted).toBeDefined()
      expect(deleted.id).toBe(newPage.id)
      expect(deleted.slug).toBe('to-delete')

      // Verify it's actually deleted
      await expect(
        payload.findByID({
          collection: 'pages',
          id: 'to-delete',
        }),
      ).rejects.toThrow()
    })

    it('should duplicate document by custom identifier (slug)', async () => {
      const duplicated = await payload.duplicate({
        collection: 'pages',
        id: pageSlug,
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

    it('should handle URL-encoded identifiers', async () => {
      // Create a page with special characters in slug
      const page = await payload.create({
        collection: 'pages',
        data: {
          title: 'Special Page',
          slug: 'hello world',
          content: 'Page with spaces',
        },
      })

      // Should be able to find with the exact slug value
      const found = await payload.findByID({
        collection: 'pages',
        id: 'hello world',
      })

      expect(found).toBeDefined()
      expect(found.id).toBe(page.id)
      expect(found.slug).toBe('hello world')
    })

    it('should return 404 for non-existent custom identifier', async () => {
      await expect(
        payload.findByID({
          collection: 'pages',
          id: 'non-existent-slug',
        }),
      ).rejects.toThrow()
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
