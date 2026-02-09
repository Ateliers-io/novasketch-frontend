# NovaSketch — Real-Time Collaborative Digital Canvas

NovaSketch is a high-performance, real-time collaborative workspace designed for remote teams to co-create visual content. Moving beyond basic paint applications, NovaSketch implements a distributed synchronization environment that ensures consistency, responsiveness, and professional-grade editing tools on a shared canvas.

## 🚀 Features

### **Core Creative Tools**

* **Vector Drawing & Shapes**: Insert and manipulate geometric shapes (rectangles, circles) and freehand paths.
* **Advanced Annotation**: Integrated text engine with support for custom fonts, styles (bold, italic, underline), and real-time placement.
* **Intelligent Eraser**: Multiple modes including "Stroke Erase" (removing entire paths) and "Partial Erase" (splitting paths via mathematical intersection logic).
* **Layer Management**: Granular control over object depth with "Bring Forward" and "Send Backward" functionality.

### **Collaborative Engine**

* **Real-Time Synchronization**: Built on **Yjs** and **WebSockets** for low-latency, conflict-free state reconciliation.
* **Presence & Awareness**: Observe live updates from other collaborators as they move, edit, or annotate the canvas.
* **User-Specific History**: Advanced Undo/Redo stack that tracks local changes vs. remote updates to prevent accidental overwriting.

### **Professional Workspace**

* **Transformation Tools**: Multi-select support with bounding box manipulation, including scaling and rotation handles.
* **Persistent Storage**: Automatic state preservation with a debounced auto-save system and manual backend synchronization.
* **Secure Access**: Integrated Firebase and Google OAuth authentication for protected sessions.
* **Export Capabilities**: Built-in support for exporting artwork to external media (e.g., PDF via jsPDF).

---

## 🛠️ Technical Stack

* **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Canvas Engine**: [Konva.js](https://konvajs.org/) (Canvas 2D API abstraction) & [React-Konva](https://konvajs.org/docs/react/index.html)
* **Real-time/CRDT**: [Yjs](https://yjs.dev/) & `y-websocket`
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [GSAP](https://greensock.com/gsap/) for UI animations
* **Authentication**: [Firebase](https://firebase.google.com/) & [Google OAuth Provider](https://www.npmjs.com/package/@react-oauth/google)
* **API Client**: [Axios](https://axios-http.com/) with custom interceptors for session management

---

## 📂 Project Structure

```text
src/
├── components/
│   ├── Whiteboard/     # Core canvas logic, hit testing, and shape rendering
│   ├── Toolbar/        # Tool selection and property controls
│   ├── ui/             # Reusable design system components
│   └── pages/          # Auth, Dashboard, and Landing views
├── contexts/           # Auth and Theme state management
├── services/           # API and Backend communication
├── types/              # TypeScript interfaces for shapes and system state
└── utils/              # Bounding box math and geometry helpers

```

---

## ⚙️ Getting Started

### **Prerequisites**

* Node.js (v18+)
* pnpm (recommended) or npm

### **Installation**

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd novasketch-frontend

```


2. **Install dependencies**
```bash
pnpm install

```


3. **Environment Setup**
Create a `.env` file based on `.env.example` and add your Firebase and Google Client ID credentials.
4. **Run Development Server**
```bash
pnpm dev

```



### **Building for Production**

```bash
pnpm build

```

---

## 🛡️ Distributed Systems & Consistency

To solve the complexities of concurrent editing, NovaSketch utilizes:

* **Conflict-Free Replicated Data Types (CRDTs)**: Via Yjs to ensure all clients converge on the same state without a central authority.
* **Optimistic UI Updates**: Local actions are reflected immediately, then reconciled with the server state.
* **Hit-Test Validation**: Mathematical verification of object intersections to ensure precision in a shared environment.
