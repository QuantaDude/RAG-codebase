import { useState } from 'react'

import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section className="title">
        <div>

          <h1>CodeBuddy</h1>
        </div>
        <button>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M7.41 6L12 10.59L16.59 6L18 7.41L13.41 12L18 16.59L16.59 18L12 13.41L7.41 18L6 16.59L10.59 12L6 7.41L7.41 6Z" fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
          </svg>
        </button>
      </section>

      {/* <div className="ticks"></div> */}

      {/* <section id="next-steps"> */}
      {/**/}
      {/* </section> */}
      <div className='pop-up container'>
        <div className='head'>
          <div>
            <p>Alert</p>
          </div>
          <div>

            <button>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7.41 6L12 10.59L16.59 6L18 7.41L13.41 12L18 16.59L16.59 18L12 13.41L7.41 18L6 16.59L10.59 12L6 7.41L7.41 6Z" fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
              </svg>
            </button>

          </div>

        </div>
        <div className='pop-up-body'>
          <p>
            Confirm deletion of codebase from storage. This operation cannot be reverted.
          </p>
        </div>
        <div className='pop-up-controls'>
          <button> close</button>
          <button> Accept</button>
        </div>
      </div>
      <div className="ticks"></div>
      <section id="spacer">
        <p>test</p>
      </section>
    </>
  )
}

export default App
