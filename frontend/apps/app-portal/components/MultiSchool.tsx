"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { multiSchoolApi, schoolApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface School {
  id: string;
  name: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  createdAt?: string;
}

export function MultiSchoolSwitcher() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: mySchools, isLoading } = useQuery({
    queryKey: ["my-schools"],
    queryFn: async () => {
      const res = await multiSchoolApi.getMySchools();
      return res.data || [];
    },
  });

  const { data: quickAccess } = useQuery({
    queryKey: ["schools-quick-access"],
    queryFn: async () => {
      const res = await multiSchoolApi.getQuickAccess();
      return res.data;
    },
  });

  const switchSchool = useMutation({
    mutationFn: async (schoolId: string) => {
      await multiSchoolApi.switchSchool(schoolId);
    },
    onSuccess: (_, schoolId) => {
      const school = mySchools?.find((s: School) => s.id === schoolId);
      if (school) {
        localStorage.setItem("current_school_id", schoolId);
        localStorage.setItem("current_school_name", school.name);
        window.location.reload();
      }
    },
    onError: () => {
      alert("Failed to switch school");
    },
  });

  const currentSchoolId = typeof window !== "undefined" ? localStorage.getItem("current_school_id") : null;
  const currentSchool = mySchools?.find((s: School) => s.id === currentSchoolId) || mySchools?.[0];

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          {currentSchool?.name?.charAt(0) || "S"}
        </div>
        <div className="text-left">
          <div className="font-medium text-gray-900 text-sm">{currentSchool?.name || "Select School"}</div>
          <div className="text-xs text-gray-500">{mySchools?.length || 0} school(s)</div>
        </div>
        <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-900">Switch School</h3>
              <p className="text-xs text-gray-500">Select a school to access its dashboard</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : mySchools?.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No schools available</div>
              ) : (
                mySchools.map((school: School) => (
                  <button
                    key={school.id}
                    onClick={() => {
                      if (school.id !== currentSchool?.id) {
                        switchSchool.mutate(school.id);
                      }
                      setShowDropdown(false);
                    }}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      school.id === currentSchool?.id ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                      {school.name?.charAt(0) || "S"}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{school.name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {school.subscriptionTier && (
                          <span className={`px-1.5 py-0.5 rounded ${
                            school.subscriptionTier === "Enterprise" ? "bg-purple-100 text-purple-700" :
                            school.subscriptionTier === "Professional" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {school.subscriptionTier}
                          </span>
                        )}
                        {school.isActive === false && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">Inactive</span>
                        )}
                      </div>
                    </div>
                    {school.id === currentSchool?.id && (
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t bg-gray-50">
              <a href="/super-admin/schools/new" className="flex items-center justify-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New School
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function MultiSchoolDashboard() {
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);

  const { data: mySchools } = useQuery({
    queryKey: ["my-schools"],
    queryFn: async () => {
      const res = await multiSchoolApi.getMySchools();
      return res.data || [];
    },
  });

  const { data: schoolData } = useQuery({
    queryKey: ["school-detail", selectedSchool],
    queryFn: async () => {
      const res = await multiSchoolApi.getSchool(selectedSchool!);
      return res.data;
    },
    enabled: !!selectedSchool,
  });

  const { data: schoolStats } = useQuery({
    queryKey: ["school-stats", selectedSchool],
    queryFn: async () => {
      const res = await multiSchoolApi.getSchoolStats(selectedSchool!);
      return res.data;
    },
    enabled: !!selectedSchool,
  });

  const stats = {
    totalStudents: schoolStats?.totalStudents || 0,
    totalTeachers: schoolStats?.totalTeachers || 0,
    totalClasses: schoolStats?.totalClasses || 0,
    activeUsers: schoolStats?.activeUsers || 0,
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Multi-School Management</h1>
            <p className="text-white/80">Manage all your schools from one dashboard</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Total Schools</div>
          <div className="text-3xl font-bold text-gray-900">{mySchools?.length || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Total Students</div>
          <div className="text-3xl font-bold text-blue-600">{stats.totalStudents.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Total Teachers</div>
          <div className="text-3xl font-bold text-green-600">{stats.totalTeachers.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Active Users</div>
          <div className="text-3xl font-bold text-purple-600">{stats.activeUsers.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Your Schools</h2>
          </div>
          <div className="divide-y">
            {mySchools?.map((school: School) => (
              <div
                key={school.id}
                onClick={() => setSelectedSchool(school.id)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedSchool === school.id ? "bg-orange-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {school.name?.charAt(0) || "S"}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{school.name}</div>
                      <div className="text-sm text-gray-500">{school.email || school.phone || "No contact info"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {school.subscriptionTier && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        school.subscriptionTier === "Enterprise" ? "bg-purple-100 text-purple-700" :
                        school.subscriptionTier === "Professional" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {school.subscriptionTier}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      school.subscriptionStatus === "active" ? "bg-green-100 text-green-700" :
                      school.subscriptionStatus === "trial" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {school.subscriptionStatus || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">School Details</h2>
          </div>
          {selectedSchool && schoolData ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                  {schoolData.name?.charAt(0) || "S"}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{schoolData.name}</h3>
                  {schoolData.registrationNumber && (
                    <p className="text-sm text-gray-500">Reg: {schoolData.registrationNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Contact</div>
                  <div className="font-medium">{schoolData.email || "N/A"}</div>
                  <div className="text-sm text-gray-600">{schoolData.phone || "N/A"}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="font-medium">{schoolData.address || "N/A"}</div>
                </div>
              </div>

              {schoolStats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{schoolStats.totalStudents || 0}</div>
                    <div className="text-xs text-blue-700">Students</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{schoolStats.totalTeachers || 0}</div>
                    <div className="text-xs text-green-700">Teachers</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">{schoolStats.totalClasses || 0}</div>
                    <div className="text-xs text-purple-700">Classes</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <a
                  href={`/super-admin/schools/${selectedSchool}`}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-center font-medium"
                >
                  Manage School
                </a>
                <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a school to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SchoolContextProvider({ children }: { children: React.ReactNode }) {
  const { data: mySchools } = useQuery({
    queryKey: ["my-schools"],
    queryFn: async () => {
      const res = await multiSchoolApi.getMySchools();
      return res.data || [];
    },
  });

  useEffect(() => {
    if (mySchools?.length === 1 && !localStorage.getItem("current_school_id")) {
      localStorage.setItem("current_school_id", mySchools[0].id);
      localStorage.setItem("current_school_name", mySchools[0].name);
    }
  }, [mySchools]);

  return <>{children}</>;
}
