const crypto = require("crypto");
const { trackableSteps, expectedTime } = require("./mouseDataConfig");

const TOKEN_AGE_MS = 12 * 60 * 60 * 1000;

function secret() {
  return process.env.MOUSE_DATA_SECRET || process.env.TEACHER_PASSWORD || "hands-on-mouse";
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload) {
  const body = encode(payload);
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token, role) {
  if (!token || !token.includes(".")) return null;
  const [body, supplied] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.role !== role || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

function teacherToken() {
  return sign({ role: "teacher", exp: Date.now() + TOKEN_AGE_MS });
}

function requireTeacher(req, res, next) {
  if (!verify(bearer(req), "teacher")) return res.status(401).json({ error: "Teacher sign-in required." });
  next();
}

function requireStudent(req, res, next) {
  const session = verify(bearer(req), "student");
  if (!session) return res.status(401).json({ error: "Student sign-in required." });
  req.mouseStudent = session;
  next();
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizedName(value) {
  return cleanName(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

function scoreForLessons(attempts, lessonIds) {
  const completedByStep = new Map();
  for (const attempt of attempts) {
    if (!lessonIds.includes(attempt.lesson_id)) continue;
    const key = `${attempt.lesson_id}:${attempt.step_id}`;
    if (attempt.status === "completed") completedByStep.set(key, attempt);
  }
  const required = lessonIds.reduce((sum, lessonId) => sum + (trackableSteps[lessonId]?.length || 0), 0);
  const completed = completedByStep.size;
  const completion = required ? (completed / required) * 100 : 0;
  const finished = [...completedByStep.values()];
  const totalWrong = finished.reduce((sum, item) => sum + Number(item.wrong_actions || 0), 0);
  const totalCorrect = finished.reduce((sum, item) => sum + Math.max(1, Number(item.correct_actions || 0)), 0);
  const accuracy = finished.length ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;
  const paceValues = finished.map(item => {
    const target = expectedTime(item.lesson_id, item.step_id) * 1000;
    const active = Math.max(1, Number(item.active_ms || 0));
    return Math.min(100, (target / active) * 100);
  });
  const pace = paceValues.length ? paceValues.reduce((a, b) => a + b, 0) / paceValues.length : 0;
  const score = Math.round(completion * 0.6 + accuracy * 0.3 + pace * 0.1);
  let grade = 1;
  if (score >= 90 && completion >= 95 && accuracy >= 90) grade = 4;
  else if (score >= 75 && completion >= 80 && accuracy >= 75) grade = 3;
  else if (score >= 50 || completion >= 50) grade = 2;
  return { grade, score, completion: Math.round(completion), accuracy: Math.round(accuracy), pace: Math.round(pace), completed, required };
}

function gradeStudent(attempts, assignedLessonIds) {
  const weeks = assignedLessonIds.map(lessonId => ({
    lessonId,
    ...scoreForLessons(attempts, [lessonId])
  }));
  if (!weeks.length) {
    return { grade: null, score: null, completion: 0, accuracy: 0, pace: 0, completed: 0, required: 0, weeks: [] };
  }
  const average = key => Math.round(weeks.reduce((sum, week) => sum + Number(week[key] || 0), 0) / weeks.length);
  const score = average("score");
  const completion = average("completion");
  const accuracy = average("accuracy");
  const pace = average("pace");
  let grade = 1;
  if (score >= 90 && completion >= 95 && accuracy >= 90) grade = 4;
  else if (score >= 75 && completion >= 80 && accuracy >= 75) grade = 3;
  else if (score >= 50 || completion >= 50) grade = 2;
  return {
    grade,
    score,
    completion,
    accuracy,
    pace,
    completed: weeks.reduce((sum, week) => sum + week.completed, 0),
    required: weeks.reduce((sum, week) => sum + week.required, 0),
    weeks
  };
}

function registerMouseDataRoutes(app, supabase) {
  app.get("/api/mouse-data/health", async (_req, res) => {
    const { error } = await supabase.from("mouse_classes").select("id", { count: "exact", head: true });
    if (error) return res.status(503).json({ ready: false, error: "Run the Hands-On Mouse database setup first." });
    res.json({ ready: true });
  });

  app.post("/api/mouse-data/join", async (req, res) => {
    const joinCode = cleanCode(req.body.classCode);
    const name = cleanName(req.body.studentName);
    if (!joinCode || !name) return res.status(400).json({ error: "Enter the class code and student name." });
    const { data: classroom } = await supabase.from("mouse_classes").select("id,name").eq("join_code", joinCode).eq("active", true).maybeSingle();
    if (!classroom) return res.status(404).json({ error: "That class code was not found." });
    const { data: students, error } = await supabase.from("mouse_students").select("id,display_name,normalized_name").eq("class_id", classroom.id).eq("active", true);
    if (error) return res.status(500).json({ error: "Could not check the class roster." });
    const student = students.find(item => item.normalized_name === normalizedName(name));
    if (!student) return res.status(404).json({ error: "Your name was not found in this class. Check the spelling or ask your teacher." });
    const token = sign({ role: "student", studentId: student.id, classId: classroom.id, exp: Date.now() + TOKEN_AGE_MS });
    res.json({ token, student: { id: student.id, name: student.display_name }, classroom: { id: classroom.id, name: classroom.name, code: joinCode } });
  });

  app.post("/api/mouse-data/attempts/start", requireStudent, async (req, res) => {
    const lessonId = String(req.body.lessonId || "");
    const stepId = String(req.body.stepId || "");
    if (!trackableSteps[lessonId]?.includes(stepId)) return res.json({ tracked: false });
    await supabase.from("mouse_class_lessons").upsert({
      class_id: req.mouseStudent.classId,
      lesson_id: lessonId,
      included_in_grade: true
    }, { onConflict: "class_id,lesson_id", ignoreDuplicates: true });
    const { count } = await supabase.from("mouse_attempts").select("id", { count: "exact", head: true }).eq("student_id", req.mouseStudent.studentId).eq("lesson_id", lessonId).eq("step_id", stepId);
    const { data, error } = await supabase.from("mouse_attempts").insert({
      class_id: req.mouseStudent.classId,
      student_id: req.mouseStudent.studentId,
      lesson_id: lessonId,
      step_id: stepId,
      step_title: cleanName(req.body.stepTitle),
      attempt_number: Number(count || 0) + 1,
      status: "started",
      active_ms: 0,
      correct_actions: 0,
      wrong_actions: 0,
      freeze_count: 0,
      frozen_ms: 0
    }).select("id,attempt_number").single();
    if (error) return res.status(500).json({ error: "Could not start activity tracking." });
    res.json({ tracked: true, attempt: data });
  });

  app.put("/api/mouse-data/attempts/:id", requireStudent, async (req, res) => {
    const update = {
      active_ms: Math.max(0, Number(req.body.activeMs || 0)),
      correct_actions: Math.max(0, Number(req.body.correctActions || 0)),
      wrong_actions: Math.max(0, Number(req.body.wrongActions || 0)),
      freeze_count: Math.max(0, Number(req.body.freezeCount || 0)),
      frozen_ms: Math.max(0, Number(req.body.frozenMs || 0)),
      status: ["started", "incomplete", "completed"].includes(req.body.status) ? req.body.status : "started",
      updated_at: new Date().toISOString()
    };
    if (update.status === "completed") update.completed_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("mouse_attempts")
      .update(update)
      .eq("id", req.params.id)
      .eq("student_id", req.mouseStudent.studentId)
      .select("id")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Could not save activity tracking."
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Activity attempt not found."
      });
    }

    res.json({ success: true });
  });

  app.get("/api/mouse-data/classes", requireTeacher, async (_req, res) => {
    const { data, error } = await supabase.from("mouse_classes").select("id,name,join_code,active,created_at,mouse_students(id,display_name,active)").order("name");
    if (error) return res.status(500).json({ error: "Could not load classes. Run the database setup first." });
    res.json({ classes: data });
  });

  app.post("/api/mouse-data/classes", requireTeacher, async (req, res) => {
    const className = cleanName(req.body.name);
    const names = [...new Set((Array.isArray(req.body.students) ? req.body.students : []).map(cleanName).filter(Boolean))];
    if (!className || !names.length) return res.status(400).json({ error: "Enter a class name and at least one student." });
    let classroom = null;
    for (let tries = 0; tries < 8 && !classroom; tries += 1) {
      const { data, error } = await supabase.from("mouse_classes").insert({ name: className, join_code: makeCode() }).select("id,name,join_code").single();
      if (!error) classroom = data;
    }
    if (!classroom) return res.status(500).json({ error: "Could not create a unique class code." });
    const rows = names.map(name => ({ class_id: classroom.id, display_name: name, normalized_name: normalizedName(name) }));
    const { error } = await supabase.from("mouse_students").insert(rows);
    if (error) return res.status(500).json({ error: "The class was created, but the roster could not be saved." });
    res.json({ classroom });
  });

  app.get("/api/mouse-data/reports/:classId", requireTeacher, async (req, res) => {
    const { data: classroom, error: classError } = await supabase.from("mouse_classes").select("id,name,join_code").eq("id", req.params.classId).single();
    if (classError) return res.status(404).json({ error: "Class not found." });
    const { data: students, error: studentError } = await supabase.from("mouse_students").select("id,display_name").eq("class_id", classroom.id).eq("active", true).order("display_name");
    if (studentError) return res.status(500).json({ error: "Could not load students." });
    const { data: attempts, error: attemptError } = await supabase.from("mouse_attempts").select("*").eq("class_id", classroom.id).order("started_at");
    if (attemptError) return res.status(500).json({ error: "Could not load activity results." });
    const { data: assignedLessons, error: lessonsError } = await supabase.from("mouse_class_lessons").select("lesson_id,assigned_at,included_in_grade").eq("class_id", classroom.id).eq("included_in_grade", true).order("assigned_at");
    if (lessonsError) return res.status(500).json({ error: "Could not load assigned lessons." });
    const assignedLessonIds = assignedLessons.map(item => item.lesson_id);
    const reportStudents = students.map(student => {
      const own = attempts.filter(
        item => item.student_id === student.id
      );

      const grade =
        gradeStudent(own, assignedLessonIds);

      grade.weeks = grade.weeks.map(week => {
        const weekAttempts = own.filter(
          item => item.lesson_id === week.lessonId
        );

        /*
         * Use the most recent completed result from
         * each activity for graded weekly statistics.
         */
        const completedByStep = new Map();

        weekAttempts.forEach(attempt => {
          if (attempt.status === "completed") {
            completedByStep.set(
              attempt.step_id,
              attempt
            );
          }
        });

        const gradedAttempts =
          [...completedByStep.values()];

        return {
          ...week,
          wrongActions: gradedAttempts.reduce(
            (sum, item) =>
              sum + Number(item.wrong_actions || 0),
            0
          ),
          incomplete: weekAttempts.filter(
            item => item.status === "incomplete"
          ).length,
          activeMs: gradedAttempts.reduce(
            (sum, item) =>
              sum + Number(item.active_ms || 0),
            0
          ),
          freezes: weekAttempts.reduce(
            (sum, item) =>
              sum + Number(item.freeze_count || 0),
            0
          ),
          frozenMs: weekAttempts.reduce(
            (sum, item) =>
              sum + Number(item.frozen_ms || 0),
            0
          )
        };
      });

      const awareness = {
        freezes: own.reduce(
          (sum, item) =>
            sum + Number(item.freeze_count || 0),
          0
        ),
        frozenMs: own.reduce(
          (sum, item) =>
            sum + Number(item.frozen_ms || 0),
          0
        ),
        wrongActions: own.reduce(
          (sum, item) =>
            sum + Number(item.wrong_actions || 0),
          0
        ),
        incomplete: own.filter(
          item => item.status === "incomplete"
        ).length
      };

      return {
        id: student.id,
        name: student.display_name,
        grade,
        awareness,
        attempts: own
      };
    });
    res.json({ classroom, assignedLessons, students: reportStudents, generatedAt: new Date().toISOString() });
  });
}

module.exports = { registerMouseDataRoutes, teacherToken };
