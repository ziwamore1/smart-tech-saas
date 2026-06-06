"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"

type Constraints = {
  maxLessonsPerTeacherPerDay: number
  maxSubjectPerDay: number
  maxConsecutivePeriods: number
  allowDoublePeriods: boolean
}

export default function ConstraintEditor({ schoolId }: { schoolId: string }) {
  const { user } = useAuth()
  const [constraints, setConstraints] = useState<Constraints>({
    maxLessonsPerTeacherPerDay: 6,
    maxSubjectPerDay: 5,
    maxConsecutivePeriods: 4,
    allowDoublePeriods: true
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetSchoolId = schoolId || user?.schoolId

  useEffect(() => {
    if (!targetSchoolId) return
    loadConstraints()
  }, [targetSchoolId])

  const loadConstraints = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await api.get(`/constraints/${targetSchoolId}`)

      if (res.data) {
        setConstraints({
          maxLessonsPerTeacherPerDay: res.data.maxLessonsPerTeacherPerDay ?? 6,
          maxSubjectPerDay: res.data.maxSubjectPerDay ?? 5,
          maxConsecutivePeriods: res.data.maxConsecutivePeriods ?? 4,
          allowDoublePeriods: res.data.allowDoublePeriods ?? true
        })
      }

    } catch (err: any) {
      console.error(err)
      if (err.response?.status !== 404) {
        setError("Failed to load constraints")
      }
    } finally {
      setLoading(false)
    }
  }

  const saveConstraints = async () => {
    try {
      setSaving(true)

      await api.post(
        `/constraints/${targetSchoolId}`,
        constraints
      )

      alert("Constraints saved successfully")

    } catch (err) {

      console.error(err)
      alert("Error saving constraints")

    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        Loading constraints...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        {error}

        <button
          onClick={loadConstraints}
          className="ml-4 px-3 py-1 bg-blue-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    )
  }

  return (

    <div className="max-w-xl bg-white p-6 rounded-xl shadow border space-y-6">

      <h2 className="text-lg font-semibold">
        Timetable Constraints
      </h2>

      {/* Teacher Rule */}
      <div>

        <label className="block text-sm font-medium mb-1">
          Max Lessons Per Teacher Per Day
        </label>

        <input
          type="number"
          min={1}
          value={constraints.maxLessonsPerTeacherPerDay}
          onChange={(e) =>
            setConstraints({
              ...constraints,
              maxLessonsPerTeacherPerDay: Number(e.target.value),
            })
          }
          className="border rounded p-2 w-full"
        />

      </div>

      {/* Subject Rule */}
      <div>

        <label className="block text-sm font-medium mb-1">
          Max Subject Lessons Per Day
        </label>

        <input
          type="number"
          min={1}
          value={constraints.maxSubjectPerDay}
          onChange={(e) =>
            setConstraints({
              ...constraints,
              maxSubjectPerDay: Number(e.target.value),
            })
          }
          className="border rounded p-2 w-full"
        />

      </div>

      {/* Consecutive Periods Rule */}
      <div>

        <label className="block text-sm font-medium mb-1">
          Max Consecutive Periods
        </label>

        <input
          type="number"
          min={1}
          value={constraints.maxConsecutivePeriods}
          onChange={(e) =>
            setConstraints({
              ...constraints,
              maxConsecutivePeriods: Number(e.target.value),
            })
          }
          className="border rounded p-2 w-full"
        />

      </div>

      {/* Double Period Rule */}
      <div className="flex items-center gap-2">

        <input
          type="checkbox"
          checked={constraints.allowDoublePeriods}
          onChange={(e) =>
            setConstraints({
              ...constraints,
              allowDoublePeriods: e.target.checked,
            })
          }
        />

        <label className="text-sm">
          Allow Double Periods
        </label>

      </div>

      {/* Buttons */}
      <div className="flex gap-3">

        <button
          onClick={saveConstraints}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Constraints"}
        </button>

        <button
          onClick={loadConstraints}
          className="border px-4 py-2 rounded hover:bg-gray-50"
        >
          Reset
        </button>

      </div>

    </div>

  )
}
