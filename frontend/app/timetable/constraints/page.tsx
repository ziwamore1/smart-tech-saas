"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import ConstraintEditor from "@/components/timetable/constraints/ConstraintEditor"

export default function ConstraintsPage(){
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (

  <main className="p-6">

   <h1 className="text-2xl font-bold mb-6">
    Timetable Constraints
   </h1>

   < ConstraintEditor schoolId={user?.schoolId || ''}/>

  </main>

  )

}
