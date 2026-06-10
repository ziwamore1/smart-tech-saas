import { useQuery } from "@tanstack/react-query";
import { teacherApi } from "@/lib/api";

export const useTeachers = () => {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      try {
        const res = await teacherApi.getAll();
        let data = res.data;

        if (data?.data !== undefined && Array.isArray(data.data)) {
          data = data.data;
        } else if (data?.data !== undefined && data?.data?.data !== undefined && Array.isArray(data.data.data)) {
          data = data.data.data;
        } else if (data?.teachers !== undefined) {
          data = data.teachers;
        } else if (data?.result !== undefined && Array.isArray(data.result)) {
          data = data.result;
        } else if (data?.items !== undefined && Array.isArray(data.items)) {
          data = data.items;
        }

        const teachers = Array.isArray(data) ? data : [];

        return teachers.map((t: any) => {
          const user = t.user || {};
          return {
            id: t.id || t._id || "",
            firstName: user.firstName || t.firstName || "",
            lastName: user.lastName || t.lastName || "",
            title: t.title || user.title || "",
            gender: t.gender || user.gender || "",
            email: user.email || t.email || "",
            phone: user.phone || t.phone || "",
            abbreviation: t.abbreviation || user.abbreviation || t.employeeNo || "",
            color: t.color || user.color || "",
            department: t.department || "",
            qualification: t.qualification || "",
            ...t,
            user,
          };
        });
      } catch (e) {
        console.error("Teacher fetch error:", e);
        return [];
      }
    },
  });

  return { teachers: data, isLoading, refetch };
};
