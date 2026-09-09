import type { MouseEvent } from "react";
import CloseButton from "../CloseButton/CloseButton";


export type PopupProps = {

  onCancel: (e: MouseEvent) => void;
  onAccept: (e: MouseEvent) => void;
  message: string;
  title?: string;
};


export default function PopupConfirmation({ onAccept, onCancel, message, title }: PopupProps) {

  return (
    <div className='pop-up container'>
      <div className='head'>
        <div>
          <p>{title ?? 'Alert'}</p>
        </div>
        <div>

          <CloseButton />

        </div>

      </div>
      <div className='pop-up-body'>
        <p>
          {message}
        </p>
      </div>
      <div className='pop-up-controls'>
        <button onClick={(e) => onCancel(e)}> close</button>
        <button onClick={(e) => onAccept(e)}> Accept</button>
      </div>
    </div>
  );
}
