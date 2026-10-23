import { describe, expect, it } from 'vitest'
import { ALL_LESSONS, gainLabel, learningGain, lessonFor } from './lessons'
import { TOPICS } from '../content/topics.generated'
import { TEMPLATES } from './quantum/templates'

const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id))

describe('lesson syllabus', () => {
  it('covers every topic exactly once', () => {
    expect(new Set(ALL_LESSONS).size).toBe(ALL_LESSONS.length)
    expect(ALL_LESSONS.length).toBe(TOPICS.length)
    for (const topic of TOPICS) expect(ALL_LESSONS).toContain(topic.id)
  })

  it('returns null for unknown topics', () => {
    expect(lessonFor('NOPE-999')).toBeNull()
  })

  it('builds the full seven-stage lab for every topic', () => {
    for (const id of ALL_LESSONS) {
      const lesson = lessonFor(id)
      expect(lesson, id).not.toBeNull()
      expect(lesson!.topicId).toBe(id)

      // Aim + theory
      expect(lesson!.aim.length).toBeGreaterThan(20)
      expect(lesson!.theory.length).toBeGreaterThan(0)
      expect(lesson!.theory.every((p) => p.length > 0)).toBe(true)
      expect(lesson!.keyIdea.length).toBeGreaterThan(0)

      // Procedure
      expect(lesson!.procedure.length).toBeGreaterThan(0)

      // Simulation is a real template
      expect(TEMPLATE_IDS.has(lesson!.simulation.templateId), `${id} → ${lesson!.simulation.templateId}`).toBe(true)

      // Pretest / posttest overlap-free
      expect(lesson!.pretest.length).toBeGreaterThanOrEqual(2)
      expect(lesson!.posttest.length).toBeGreaterThanOrEqual(2)
      const ids = new Set([...lesson!.pretest, ...lesson!.posttest].map((q) => q.id))
      expect(ids.size).toBe(lesson!.pretest.length + lesson!.posttest.length)

      // References
      expect(lesson!.references.length).toBeGreaterThan(0)
      for (const ref of lesson!.references) {
        expect(ref.url).toMatch(/^https?:\/\//)
        expect(ref.label.length).toBeGreaterThan(0)
      }

      expect(lesson!.xp).toBeGreaterThan(0)
      expect(lesson!.minutes).toBeGreaterThan(0)
    }
  })

  it('gives every question a valid answer index and explanation', () => {
    for (const id of ALL_LESSONS) {
      const lesson = lessonFor(id)!
      for (const q of [...lesson.pretest, ...lesson.posttest]) {
        expect(q.options.length).toBeGreaterThanOrEqual(2)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(q.options.length)
        expect(q.explanation.length).toBeGreaterThan(0)
        expect([1, 2, 3]).toContain(q.difficulty)
      }
    }
  })
})

describe('Hake normalised gain', () => {
  it('computes (post − pre) / (1 − pre)', () => {
    expect(learningGain(0.5, 0.8)).toBeCloseTo(0.6, 10)
    expect(learningGain(0, 1)).toBeCloseTo(1, 10)
    expect(learningGain(0, 0)).toBe(0)
    expect(learningGain(0.25, 0.25)).toBe(0)
  })

  it('handles ceiling and regression cases', () => {
    expect(learningGain(1, 1)).toBe(0)
    expect(learningGain(1, 0.5)).toBe(-1)
    expect(learningGain(0.8, 0.6)).toBeLessThan(0)
  })

  it('labels gains at the physics-education thresholds', () => {
    expect(gainLabel(0.7)).toBe('High gain')
    expect(gainLabel(0.3)).toBe('Medium gain')
    expect(gainLabel(0.1)).toBe('Low gain')
    expect(gainLabel(0)).toBe('No gain')
    expect(gainLabel(-0.2)).toBe('No gain')
  })
})
