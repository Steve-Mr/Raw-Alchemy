import RawUploader from './components/RawUploader';
import WebGLStatus from './components/WebGLStatus';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-10">
       <h1 className="text-3xl font-bold text-gray-800 mb-8">Raw Alchemy Web</h1>
       <div className="w-full max-w-4xl px-4 space-y-6">
          <WebGLStatus />
          <RawUploader />
       </div>
    </div>
  )
}

export default App
