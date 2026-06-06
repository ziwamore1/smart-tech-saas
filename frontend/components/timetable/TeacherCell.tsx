"use client"

export default function TeacherCell({slot}:any){

 if(!slot){
  return <div className="border h-20 bg-gray-50"/>
 }

 return(

  <div className="border h-20 flex flex-col items-center justify-center bg-blue-100">

   <div className="font-semibold">
    {slot.subject.name}
   </div>

   <div className="text-xs">
    {slot.timetable.class.name}
   </div>

  </div>

 )

}