import { useQuery } from "@tanstack/react-query";
import { subjectApi, classApi, api } from "@/lib/api";

export const useSubjects = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      let data = res.data?.data || res.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
      }
      return Array.isArray(data) ? data : [];
    },
  });

  return { subjects: data, isLoading };
};

export const useClasses = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data?.data || res.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
      }
      return Array.isArray(data) ? data : [];
    },
  });

  return { classes: data, isLoading };
};

export const useClassrooms = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      try {
        const res = await api.get("/classrooms");
        let data = res.data?.data || res.data;
        if (data?.data) data = data.data;
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("GET classrooms error:", e);
        return [];
      }
    },
  });

  return { classrooms: data, isLoading };
};
