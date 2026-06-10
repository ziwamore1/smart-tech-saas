import UniversalTimetable from "@/components/timetable/UniversalTimetable";

export default function StudentTimetablePage() {
  return (
    <UniversalTimetable 
      schoolName="ADASTRA SECONDARY SCHOOL"
      viewType="student"
      showBreaks={true}
      numberOfPeriods={9}
    />
  );
}
