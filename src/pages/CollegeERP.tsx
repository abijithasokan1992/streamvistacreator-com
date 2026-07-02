import React, { useState } from "react";
import { 
  Building2, Users, UserSquare2, BookOpen, GraduationCap, Calendar, 
  FileSpreadsheet, ClipboardList, Wallet, Library, Home, Bus, 
  Bell, FileText, Activity, ShieldAlert, KeyRound, Database, 
  Cpu, ArrowRightLeft, CreditCard, ChevronRight, CheckCircle2, 
  XCircle, Clock, Search, HelpCircle, Sparkles, Upload, Download,
  Play, RefreshCw, Layers
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

// Mock database initial state matching schema.sql
interface College { id: number; name: string; domain: string; }
interface Admission { id: number; firstName: string; lastName: string; email: string; course: string; status: "PENDING" | "APPROVED" | "REJECTED"; date: string; }
interface Student { id: number; name: string; email: string; roll: string; dept: string; course: string; attendance: number; feesPaid: number; feesDue: number; photo: string; }
interface Book { id: number; title: string; author: string; isbn: string; quantity: number; available: number; }
interface Document { id: number; entityType: string; name: string; size: string; ociObjectName: string; uploadedAt: string; }

const formattedDate = new Date().toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
});

export default function CollegeERP() {
  const [activeRole, setActiveRole] = useState<string>("College Admin");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Dynamic State matching database records
  const [colleges] = useState<College[]>([
    { id: 1, name: "Apex University", domain: "apexuniv.edu" },
    { id: 2, name: "OCI Institute of Technology", domain: "oci-tech.edu" }
  ]);
  const [selectedCollege, setSelectedCollege] = useState<number>(1);

  const [admissions, setAdmissions] = useState<Admission[]>([
    { id: 1, firstName: "Ada", lastName: "Lovelace", email: "ada@programming.org", course: "Database Management Systems", status: "PENDING", date: "2026-07-01" },
    { id: 2, firstName: "Nikola", lastName: "Tesla", email: "nikola@electricity.com", course: "Data Structures & Algorithms", status: "APPROVED", date: "2026-06-30" },
    { id: 3, firstName: "Albert", lastName: "Einstein", email: "albert@relativity.net", course: "Calculus & Algebra", status: "PENDING", date: "2026-07-02" }
  ]);

  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: "Marie Curie", email: "student1@apexuniv.edu", roll: "ROLL-CSE-101", dept: "CSE", course: "Database Management Systems", attendance: 92, feesPaid: 5000, feesDue: 250, photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150" },
    { id: 2, name: "Alan Turing", email: "student2@oci-tech.edu", roll: "ROLL-IT-401", dept: "IT", course: "Cloud Infrastructure Architecture", attendance: 85, feesPaid: 0, feesDue: 5250, photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
  ]);

  const [books, setBooks] = useState<Book[]>([
    { id: 1, title: "Database System Concepts (7th Edition)", author: "Avi Silberschatz", isbn: "978-0078022135", quantity: 10, available: 9 },
    { id: 2, title: "Introduction to Algorithms (4th Edition)", author: "Thomas Cormen", isbn: "978-0262046305", quantity: 5, available: 5 },
    { id: 3, title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", quantity: 8, available: 3 }
  ]);

  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, entityType: "STUDENT", name: "marie_curie_id_card.pdf", size: "1.04 MB", ociObjectName: "tenancy/apexuniv/docs/marie_curie_id_card.pdf", uploadedAt: "2026-07-02 09:30" },
    { id: 2, entityType: "ADMISSION", name: "tesla_transcripts.pdf", size: "2.51 MB", ociObjectName: "tenancy/apexuniv/docs/tesla_transcripts.pdf", uploadedAt: "2026-07-01 14:15" }
  ]);

  // Attendance Register state
  const [attendanceRegister, setAttendanceRegister] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true
  });

  // AI Prompt and Response state
  const [aiPrompt, setAiPrompt] = useState<string>("Generate a campus announcement welcoming students for the upcoming Fall Semester starting August 15, 2026.");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Schema Viewer - DDL lookup definitions
  const tableDefinitions = [
    { name: "colleges", cols: "id (PK), name, domain, address, contact_phone, contact_email, created_at" },
    { name: "users", cols: "id (PK), college_id (FK), role_id (FK), email, password_hash, first_name, last_name, status, created_at" },
    { name: "students", cols: "id (PK), user_id (FK), college_id (FK), department_id, course_id, academic_year_id, admission_number, roll_number" },
    { name: "faculty", cols: "id (PK), user_id (FK), college_id (FK), department_id, designation, qualification, phone_number" },
    { name: "admissions", cols: "id (PK), college_id (FK), first_name, last_name, email, phone, course_id, status, submitted_at, reviewed_by" },
    { name: "attendance", cols: "id (PK), student_id (FK), course_id (FK), faculty_id (FK), attendance_date, status, remarks" },
    { name: "timetable", cols: "id (PK), college_id, department_id, course_id, faculty_id, academic_year_id, day_of_week, start_time, end_time, classroom" },
    { name: "exams", cols: "id (PK), college_id, course_id, academic_year_id, name, exam_date, max_marks, min_marks" },
    { name: "marks", cols: "id (PK), exam_id (FK), student_id (FK), marks_obtained, grade, remarks" },
    { name: "fee_structure", cols: "id (PK), college_id, course_id, academic_year_id, fee_type, amount, due_date" },
    { name: "fee_payments", cols: "id (PK), student_id (FK), fee_structure_id (FK), amount_paid, payment_date, payment_method, transaction_id, status" },
    { name: "library_books", cols: "id (PK), college_id, title, author, isbn, quantity, available" },
    { name: "book_issues", cols: "id (PK), book_id (FK), user_id (FK), issue_date, due_date, return_date, fine_amount, status" },
    { name: "hostel_rooms", cols: "id (PK), college_id, block_name, room_number, capacity, occupied, status" },
    { name: "transport_routes", cols: "id (PK), college_id, route_name, driver_name, driver_phone, vehicle_number" },
    { name: "notifications", cols: "id (PK), college_id, sender_id, recipient_id, title, message, created_at, is_read" },
    { name: "documents", cols: "id (PK), college_id, uploader_id, entity_type, entity_id, file_name, file_size, file_type, oci_object_name, uploaded_at" },
    { name: "audit_logs", cols: "id (PK), college_id, user_id, action, table_name, record_id, old_values, new_values, logged_at, ip_address" }
  ];

  // Handler functions
  const handleApproveAdmission = (id: number) => {
    setAdmissions(prev => prev.map(adm => {
      if (adm.id === id) {
        toast.success(`Approved Admission for ${adm.firstName} ${adm.lastName}!`);
        
        // Add approved student to dynamic list
        const newStudentId = students.length + 1;
        setStudents(sPrev => [
          ...sPrev,
          {
            id: newStudentId,
            name: `${adm.firstName} ${adm.lastName}`,
            email: `${adm.firstName.toLowerCase()}.${adm.lastName.toLowerCase()}@apexuniv.edu`,
            roll: `ROLL-CSE-${101 + newStudentId}`,
            dept: "CSE",
            course: adm.course,
            attendance: 100,
            feesPaid: 0,
            feesDue: 5000,
            photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
          }
        ]);
        return { ...adm, status: "APPROVED" };
      }
      return adm;
    }));
  };

  const handleRejectAdmission = (id: number) => {
    setAdmissions(prev => prev.map(adm => {
      if (adm.id === id) {
        toast.error(`Rejected Admission for ${adm.firstName} ${adm.lastName}`);
        return { ...adm, status: "REJECTED" };
      }
      return adm;
    }));
  };

  const handlePayFees = (studentId: number) => {
    setStudents(prev => prev.map(stud => {
      if (studentId === stud.id) {
        if (stud.feesDue <= 0) {
          toast.info("All fees are already paid!");
          return stud;
        }
        
        // Simulate Razorpay checkout overlay
        toast.promise(
          new Promise((resolve) => setTimeout(resolve, 1500)),
          {
            loading: 'Contacting Razorpay Gateway securely...',
            success: () => {
              const secureTxId = typeof crypto !== 'undefined' && crypto.randomUUID 
                ? crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()
                : Math.random().toString(36).substring(2, 14).toUpperCase();
              toast.success(`Recorded Razorpay payment of ₹${stud.feesDue}!`);
              return `Successfully credited ₹${stud.feesDue} to student ledger. ID: pay_RZP_${secureTxId}`;
            },
            error: 'Razorpay payment failed.',
          }
        );

        return {
          ...stud,
          feesPaid: stud.feesPaid + stud.feesDue,
          feesDue: 0
        };
      }
      return stud;
    }));
  };

  const handleCheckoutBook = (bookId: number) => {
    setBooks(prev => prev.map(bk => {
      if (bk.id === bookId) {
        if (bk.available <= 0) {
          toast.error("Book currently out of stock!");
          return bk;
        }
        toast.success(`Checked out "${bk.title}" successfully.`);
        return { ...bk, available: bk.available - 1 };
      }
      return bk;
    }));
  };

  const handleReturnBook = (bookId: number) => {
    setBooks(prev => prev.map(bk => {
      if (bk.id === bookId) {
        if (bk.available >= bk.quantity) {
          toast.error("All copies of this book are already in library!");
          return bk;
        }
        toast.success(`Returned copy of "${bk.title}" to librarian.`);
        return { ...bk, available: bk.available + 1 };
      }
      return bk;
    }));
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const newDoc: Document = {
      id: documents.length + 1,
      entityType: "GENERAL",
      name: "syllabus_fall_2026.pdf",
      size: "1.42 MB",
      ociObjectName: "tenancy/apexuniv/docs/syllabus_fall_2026.pdf",
      uploadedAt: "Just now"
    };
    setDocuments(prev => [...prev, newDoc]);
    toast.success("Document uploaded successfully to OCI Object Storage bucket: erp-documents");
  };

  const handleCallAI = () => {
    setAiLoading(true);
    setAiResponse("");
    setTimeout(() => {
      setAiLoading(false);
      if (aiPrompt.toLowerCase().includes("announcement") || aiPrompt.toLowerCase().includes("notice")) {
        setAiResponse(`📢 CAMPUS BROADCAST: WELCOME BACK STUDENTS!\n\nDate: August 15, 2026\nFrom: Office of the Registrar, Apex University\n\nDear Students,\n\nWelcome back to an exciting new academic year at Apex University! We are thrilled to resume campus sessions on Monday, August 15, 2026. Please complete your registration and fee payments via the APEX Portal before the due date. \n\nSee you on campus!\n\n- Dr. Albert Einstein\nPrincipal, Apex University`);
      } else {
        setAiResponse(`🤖 AI Admissions Assistant:\n\nThank you for asking! Based on our OCI DB admissions table, we have received 3 applications for the academic year 2026-27. 1 has been approved (Nikola Tesla) and 2 are currently pending review (Ada Lovelace and Albert Einstein). Let me know if you would like me to draft acceptance letters for the pending candidates.`);
      }
      toast.success("Successfully completed prompt using OpenAI models.");
    }, 1500);
  };

  // Recharts graphs mock data
  const attendanceChartData = [
    { name: "Week 1", rate: 82 },
    { name: "Week 2", rate: 85 },
    { name: "Week 3", rate: 89 },
    { name: "Week 4", rate: 94 }
  ];

  const financialChartData = [
    { name: "Tuition", collected: 5000, pending: 5250 },
    { name: "Library", collected: 250, pending: 250 },
    { name: "Hostel", collected: 1200, pending: 2400 }
  ];

  const admissionsPieData = [
    { name: "Approved", value: admissions.filter(a => a.status === "APPROVED").length },
    { name: "Pending", value: admissions.filter(a => a.status === "PENDING").length },
    { name: "Rejected", value: admissions.filter(a => a.status === "REJECTED").length }
  ];
  const COLORS = ["#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Upper Brand Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Autonomous College ERP
              <Badge variant="outline" className="text-orange-400 border-orange-500/30 bg-orange-500/10 gap-1 font-semibold text-xs">
                <Cpu className="w-3 h-3 animate-pulse" /> Oracle OCI & APEX
              </Badge>
            </h1>
            <p className="text-xs text-slate-400">Multi-tenant Cloud ERP Sandbox Studio</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Tenant Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Tenancy:</span>
            <select 
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
              value={selectedCollege}
              onChange={(e) => {
                setSelectedCollege(Number(e.target.value));
                toast.success(`Switched workspace directory to ${colleges.find(c => c.id === Number(e.target.value))?.name}`);
              }}
            >
              {colleges.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
            </select>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Role context:</span>
            <select 
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
              value={activeRole}
              onChange={(e) => {
                setActiveRole(e.target.value);
                toast(`Switched perspective to ${e.target.value}`);
              }}
            >
              <option value="Super Admin" className="bg-slate-900">Super Admin</option>
              <option value="College Admin" className="bg-slate-900">College Admin</option>
              <option value="Admission Officer" className="bg-slate-900">Admission Officer</option>
              <option value="Faculty" className="bg-slate-900">Faculty</option>
              <option value="Student" className="bg-slate-900">Student</option>
              <option value="Accountant" className="bg-slate-900">Accountant</option>
              <option value="Librarian" className="bg-slate-900">Librarian</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Modules</p>
            
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "dashboard" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Home className="w-4 h-4" /> Dashboard Shell
            </button>

            <button 
              onClick={() => setActiveTab("admissions")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "admissions" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <span className="flex items-center gap-3"><GraduationCap className="w-4 h-4" /> Admissions</span>
              {admissions.filter(a => a.status === "PENDING").length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                  {admissions.filter(a => a.status === "PENDING").length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "students" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Users className="w-4 h-4" /> Students Directory
            </button>

            <button 
              onClick={() => setActiveTab("attendance")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "attendance" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <ClipboardList className="w-4 h-4" /> Attendance Register
            </button>

            <button 
              onClick={() => setActiveTab("fees")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "fees" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Wallet className="w-4 h-4" /> Fees & Invoicing
            </button>

            <button 
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "library" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Library className="w-4 h-4" /> Library Inventory
            </button>

            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mt-4 mb-2">Cloud Tools</p>

            <button 
              onClick={() => setActiveTab("object-storage")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "object-storage" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Upload className="w-4 h-4" /> OCI Object Storage
            </button>

            <button 
              onClick={() => setActiveTab("ai-features")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "ai-features" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Sparkles className="w-4 h-4" /> OpenAI AI Assistant
            </button>

            <button 
              onClick={() => setActiveTab("schema-viewer")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "schema-viewer" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"}`}
            >
              <Database className="w-4 h-4" /> Database Schema
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Active Security
            </h4>
            <p className="text-[11px] text-slate-400 leading-tight">
              Row-Level Security (VPD) restricts database queries to college ID: <strong className="text-slate-200">#{selectedCollege}</strong>.
            </p>
          </div>
        </aside>

        {/* Dynamic Center Work Area */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-950">
          
          {/* Tab: Dashboard Overview */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Dashboard Console</h2>
                  <p className="text-sm text-slate-400">APEX Interactive Charts rendering from ATP database schemas</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1.5 py-1 px-2.5 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live OCI Session Active
                </Badge>
              </div>

              {/* Status Metrics Grids */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-slate-400 text-xs">Total Active Students</CardDescription>
                    <CardTitle className="text-2xl font-bold text-white flex items-center justify-between">
                      {students.length}
                      <Users className="w-5 h-5 text-blue-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span>↑ 100% since last week (New admission approved)</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-slate-400 text-xs">Pending Admissions</CardDescription>
                    <CardTitle className="text-2xl font-bold text-white flex items-center justify-between">
                      {admissions.filter(a => a.status === "PENDING").length}
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-[10px] text-slate-400">Requires review by Admission Officer</div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-slate-400 text-xs">Fees Ledger Balance</CardDescription>
                    <CardTitle className="text-2xl font-bold text-white flex items-center justify-between">
                      ₹{students.reduce((acc, s) => acc + s.feesDue, 0)}
                      <Wallet className="w-5 h-5 text-emerald-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-[10px] text-rose-400 font-semibold">Payment link active on Student console</div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-slate-400 text-xs">Avg. Attendance Rate</CardDescription>
                    <CardTitle className="text-2xl font-bold text-white flex items-center justify-between">
                      {Math.round(students.reduce((acc, s) => acc + s.attendance, 0) / students.length)}%
                      <Activity className="w-5 h-5 text-rose-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span>Excellent (Target is &gt;80%)</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Graphical APEX Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white font-semibold">Fee Ledger Collection Status</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Collected vs Pending fees in Rupees by category</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Legend />
                        <Bar dataKey="collected" fill="#10B981" name="Collected (₹)" />
                        <Bar dataKey="pending" fill="#EF4444" name="Pending (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white font-semibold">Admissions Pipelines</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Submit applications breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 flex flex-col justify-between">
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={admissionsPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {admissionsPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Approved ({admissions.filter(a => a.status === "APPROVED").length})
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Pending ({admissions.filter(a => a.status === "PENDING").length})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dynamic Role Recommendations */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-orange-400 animate-bounce" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Suggested Work Tasks</h4>
                    <p className="text-xs text-slate-400 leading-tight">
                      Based on your role <strong className="text-orange-400">{activeRole}</strong>, you have pending actions in the ERP platform database.
                    </p>
                  </div>
                </div>
                <div>
                  {activeRole === "College Admin" && <Button onClick={() => setActiveTab("schema-viewer")} size="sm" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold">Manage Database Tables</Button>}
                  {activeRole === "Admission Officer" && <Button onClick={() => setActiveTab("admissions")} size="sm" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold">Review Applications</Button>}
                  {activeRole === "Faculty" && <Button onClick={() => setActiveTab("attendance")} size="sm" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold">Record Attendance</Button>}
                  {activeRole === "Student" && <Button onClick={() => setActiveTab("fees")} size="sm" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold">Pay Term Dues</Button>}
                  {activeRole === "Super Admin" && <Button onClick={() => setActiveTab("schema-viewer")} size="sm" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold">Explore ATP Schemas</Button>}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Admissions Module */}
          {activeTab === "admissions" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-7 h-7 text-orange-500" /> Admissions Processing Module
                </h2>
                <p className="text-sm text-slate-400">Manage candidate portfolios, evaluate academic credentials, and approve onboarding rosters</p>
              </div>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-base text-white">APEX Interactive Report: New Student Applications</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Direct query feed of the `admissions` table</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4">Applicant Name</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Applied Course</th>
                          <th className="px-6 py-4">Date Submitted</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {admissions.map(adm => (
                          <tr key={adm.id} className="hover:bg-slate-800/30">
                            <td className="px-6 py-4 font-semibold text-white">{adm.firstName} {adm.lastName}</td>
                            <td className="px-6 py-4 text-slate-400">{adm.email}</td>
                            <td className="px-6 py-4">{adm.course}</td>
                            <td className="px-6 py-4 text-slate-400">{adm.date}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge className={
                                adm.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                adm.status === "REJECTED" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }>
                                {adm.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {adm.status === "PENDING" ? (
                                <div className="flex gap-2 justify-end">
                                  <Button 
                                    size="xs" 
                                    onClick={() => handleApproveAdmission(adm.id)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    size="xs" 
                                    variant="destructive"
                                    onClick={() => handleRejectAdmission(adm.id)}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-xs italic">Reviewed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: Student Directory */}
          {activeTab === "students" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="w-7 h-7 text-orange-500" /> Student Directory
                </h2>
                <p className="text-sm text-slate-400">Card-based list dynamically linked to the `students` & `users` tables</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {students.map(s => (
                  <Card key={s.id} className="bg-slate-900 border-slate-800 flex items-start p-4 gap-4">
                    <img 
                      src={s.photo} 
                      alt={s.name} 
                      className="w-20 h-20 rounded-xl object-cover border border-slate-700 bg-slate-950" 
                    />
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">{s.name}</h3>
                          <p className="text-xs text-slate-400">{s.email}</p>
                        </div>
                        <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/5 text-[10px]">
                          {s.roll}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-xs text-slate-300">
                        <div>Dept: <strong className="text-white">{s.dept}</strong></div>
                        <div>Course: <strong className="text-white truncate block max-w-[130px]" title={s.course}>{s.course}</strong></div>
                      </div>

                      <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Attendance Rate</span>
                          <span className={s.attendance >= 85 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                            {s.attendance}%
                          </span>
                        </div>
                        <Progress value={s.attendance} className="h-1.5 bg-slate-950" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Attendance Register */}
          {activeTab === "attendance" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-7 h-7 text-orange-500" /> Daily Attendance Register
                </h2>
                <p className="text-sm text-slate-400">Faculty console to register daily class rosters. Automatically syncs with database ledger sheets.</p>
              </div>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base text-white">Class Register: Database Management Systems (CSE-301)</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Date context: {formattedDate}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t border-slate-800">
                  <div className="p-4 flex flex-col gap-4">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center justify-between border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <img src={s.photo} className="w-10 h-10 rounded-lg object-cover" />
                          <div>
                            <h4 className="font-semibold text-white text-sm">{s.name}</h4>
                            <p className="text-xs text-slate-400">{s.roll}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">Status:</span>
                          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                              onClick={() => setAttendanceRegister(p => ({ ...p, [s.id]: true }))}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${attendanceRegister[s.id] ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                            >
                              Present
                            </button>
                            <button
                              onClick={() => setAttendanceRegister(p => ({ ...p, [s.id]: false }))}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!attendanceRegister[s.id] ? "bg-rose-500 text-slate-100 shadow" : "text-slate-400 hover:text-white"}`}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end gap-2 mt-4">
                      <Button 
                        onClick={() => {
                          toast.promise(
                            new Promise((resolve) => setTimeout(resolve, 1000)),
                            {
                              loading: 'Submitting daily roster to OCI ATP databases...',
                              success: 'Attendance Register recorded successfully and audit triggers executed.',
                              error: 'Failed to record roster.',
                            }
                          );
                        }} 
                        className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold"
                      >
                        Submit Daily Register
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: Fees Ledger */}
          {activeTab === "fees" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Wallet className="w-7 h-7 text-orange-500" /> Fees & Invoicing Ledger
                </h2>
                <p className="text-sm text-slate-400">Accountant financial ledger console with Razorpay transaction callback simulator</p>
              </div>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">Student Term Bills & Payments Ledger</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Querying of `fee_structure` and `fee_payments` tables</CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs text-slate-400 bg-slate-950 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4">Student</th>
                          <th className="px-6 py-4">Assigned Tuition Course</th>
                          <th className="px-6 py-4 text-right">Fee Dues (₹)</th>
                          <th className="px-6 py-4 text-right">Amount Paid (₹)</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {students.map(s => (
                          <tr key={s.id} className="hover:bg-slate-800/30">
                            <td className="px-6 py-4 font-semibold text-white">{s.name}</td>
                            <td className="px-6 py-4">{s.course}</td>
                            <td className="px-6 py-4 text-right text-rose-400 font-semibold">₹{s.feesDue}</td>
                            <td className="px-6 py-4 text-right text-emerald-400 font-semibold">₹{s.feesPaid}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge className={s.feesDue === 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                                {s.feesDue === 0 ? "PAID" : "PENDING"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {s.feesDue > 0 ? (
                                <Button 
                                  size="xs" 
                                  onClick={() => handlePayFees(s.id)}
                                  className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold gap-1.5"
                                >
                                  <CreditCard className="w-3.5 h-3.5" /> Pay ₹{s.feesDue}
                                </Button>
                              ) : (
                                <span className="text-slate-500 text-xs italic flex items-center justify-end gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: Library Catalog */}
          {activeTab === "library" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Library className="w-7 h-7 text-orange-500" /> Library Book Inventory
                </h2>
                <p className="text-sm text-slate-400">Library issue register tracking available stocks and loans lists</p>
              </div>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base text-white">Book Stock Registers</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Live inventory linking triggers upon issue/return cycles</CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs text-slate-400 bg-slate-950 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4">Book Title</th>
                          <th className="px-6 py-4">Author</th>
                          <th className="px-6 py-4">ISBN</th>
                          <th className="px-6 py-4 text-center">Available Stock</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {books.map(bk => (
                          <tr key={bk.id} className="hover:bg-slate-800/30">
                            <td className="px-6 py-4 font-semibold text-white">{bk.title}</td>
                            <td className="px-6 py-4 text-slate-400">{bk.author}</td>
                            <td className="px-6 py-4 text-slate-500">{bk.isbn}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge className={bk.available > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                                {bk.available} of {bk.quantity} copies
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button 
                                  size="xs" 
                                  variant="outline"
                                  onClick={() => handleCheckoutBook(bk.id)}
                                  disabled={bk.available <= 0}
                                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                                >
                                  Check Out
                                </Button>
                                <Button 
                                  size="xs" 
                                  variant="outline"
                                  onClick={() => handleReturnBook(bk.id)}
                                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                                >
                                  Return Copy
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: OCI Object Storage */}
          {activeTab === "object-storage" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Upload className="w-7 h-7 text-orange-500" /> OCI Object Storage Bucket Dashboard
                </h2>
                <p className="text-sm text-slate-400">Securely sync folders with the OCI bucket: <strong className="text-orange-400">erp-college-vault</strong></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-slate-800 md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Upload New Document</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Simulate direct transmission to OCI API endpoints</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleFileUpload} className="flex flex-col gap-4">
                      <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 cursor-pointer transition-all flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <span className="text-xs font-semibold text-white">Choose File</span>
                        <span className="text-[10px] text-slate-500">PDF, PNG, JPG (Max 5MB)</span>
                      </div>
                      <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold w-full">
                        Upload to Cloud Bucket
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Stored Document Roster (ATP Meta-index)</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Files mapped to relational keys in the `documents` table</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 border-t border-slate-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 bg-slate-950 border-b border-slate-800">
                          <tr>
                            <th className="px-6 py-4">File Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">File Size</th>
                            <th className="px-6 py-4">OCI Object Name Path</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {documents.map(doc => (
                            <tr key={doc.id} className="hover:bg-slate-800/30">
                              <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400" /> {doc.name}
                              </td>
                              <td className="px-6 py-4">
                                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                                  {doc.entityType}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-slate-400">{doc.size}</td>
                              <td className="px-6 py-4 text-slate-500 text-xs font-mono">{doc.ociObjectName}</td>
                              <td className="px-6 py-4 text-right">
                                <Button 
                                  size="xs" 
                                  variant="outline"
                                  onClick={() => toast.success(`Initiated browser download of OCI file object: ${doc.name}`)}
                                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Tab: OpenAI AI Assistant */}
          {activeTab === "ai-features" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-7 h-7 text-orange-500" /> AI Features Sandbox (OpenAI API Connection)
                </h2>
                <p className="text-sm text-slate-400">Generate campus bulletins, notices, summaries of student progress lists, and automate FAQ chatbots answers</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Ask AI Assistant</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Enter commands to generate newsletters, notice bulletins, or query student data summaries</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <textarea
                      rows={5}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-orange-500 outline-none w-full resize-none font-mono"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        onClick={() => setAiPrompt("Generate acceptance email draft for Candidate Nikola Tesla.")}
                        size="xs" 
                        variant="outline" 
                        className="border-slate-700 text-slate-300"
                      >
                        Try Option 2: Draft Email
                      </Button>
                      <Button 
                        onClick={handleCallAI}
                        disabled={aiLoading}
                        className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold gap-1.5"
                      >
                        {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Run OpenAI Prompt
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base text-white">AI Assistant Response Output</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Simulated live JSON output feed from OpenAI API</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-64 flex flex-col justify-center bg-slate-950/50 rounded-lg border border-slate-800 m-4 mt-0 p-4 font-mono text-xs whitespace-pre-line text-slate-300">
                    {aiLoading ? (
                      <div className="text-center flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
                        <span className="text-slate-400">Processing tokens, drafting response with GPT-4o models...</span>
                      </div>
                    ) : aiResponse ? (
                      aiResponse
                    ) : (
                      <span className="text-slate-500 italic">Configure prompt at left and click Run Prompt.</span>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Tab: Database Schema Viewer */}
          {activeTab === "schema-viewer" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Database className="w-7 h-7 text-orange-500" /> Database Schema Registry
                </h2>
                <p className="text-sm text-slate-400">Review deployment models and active relational tables within the OCI ATP instance</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                  <CardHeader className="pb-3 border-b border-slate-800">
                    <CardTitle className="text-base text-white">Relational Tables Directory</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Total tables defined in schema.sql: <strong className="text-orange-400">18 Core + 4 Support Tables</strong></CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-y-auto max-h-[480px]">
                      <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 bg-slate-950 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="px-6 py-4">Table Name</th>
                            <th className="px-6 py-4">Mapped Column Keys & Types</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {tableDefinitions.map(tbl => (
                            <tr key={tbl.name} className="hover:bg-slate-800/20">
                              <td className="px-6 py-3.5 font-bold text-slate-100 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-orange-400" /> {tbl.name}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-slate-400 text-xs">{tbl.cols}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Execution Commands</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Run test migrations inside local simulation environment</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed">
                      $ sqlplus admin/password@atp_db <br />
                      SQL&gt; @schema.sql <br />
                      SQL&gt; @security_policies.sql <br />
                      SQL&gt; @ords_apis.sql <br />
                      SQL&gt; @seed_data.sql <br />
                    </div>

                    <Button 
                      onClick={() => {
                        toast.promise(
                          new Promise((resolve) => setTimeout(resolve, 2000)),
                          {
                            loading: 'Refreshing simulated APEX application links...',
                            success: 'Database synchronizations and trigger procedures validated successfully! Verified all 22 relational entities.',
                            error: 'Verification failed.',
                          }
                        );
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold gap-1.5 w-full"
                    >
                      <RefreshCw className="w-4 h-4" /> Run Verification Tests
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
