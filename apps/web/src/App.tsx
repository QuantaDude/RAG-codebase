
import './App.css'
import Chat from './components/Chat/Chat'

function App() {

  return (
    <>
      <section className="title">
        <div>

          <h1>CodeBuddy</h1>
        </div>
        {/* <CloseButton /> */}
      </section>

      {/* <PopupConfirmation message='Hello this is a sample text!' title='Confirm' onCancel={sub} onAccept={add} /> */}


      <Chat />
      <div className="ticks"></div>
      <section id="spacer">
        <p>developed with 💛 by a human.</p>
      </section>
    </>
  )
}

export default App
