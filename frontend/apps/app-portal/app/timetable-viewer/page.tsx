import UniversalTimetable from "@/components/timetable/UniversalTimetable";

export default function TimetableViewerPage() {
  return (
    <UniversalTimetable 
      schoolName="ADASTRA SECONDARY SCHOOL"
      viewType="class"
      showBreaks={true}
      numberOfPeriods={9}
    />
  );
}
