
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

      {/* <div className="ticks"></div> */}

      {/* <section id="next-steps"> */}
      {/**/}
      {/* </section> */}
      {/* <PopupConfirmation message='Hello this is a sample text!' title='Confirm' onCancel={sub} onAccept={add} /> */}


      <Chat />
      {/* <div className="ticks"></div> */}
      {/* <section id="spacer"> */}
      {/*   <p>test</p> */}
      {/* </section> */}
    </>
  )
}

export default App
