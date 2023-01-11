import { useState } from 'react'
import { FaCheck, FaCopy } from 'react-icons/fa'

const CopyButton: React.FC<{ copyText: string }> = ({ copyText }) => {
  const [isCopied, setIsCopied] = useState(false)

  async function copyTextToClipboard (text: string): Promise<void> {
    if ('clipboard' in navigator) {
      await navigator.clipboard.writeText(text)
    } else {
      document.execCommand('copy', true, text)
    }
  }

  // onClick handler function for the copy button
  const handleCopyClick = (): void => {
    // Asynchronously call copyTextToClipboard
    copyTextToClipboard(copyText)
      .then(() => {
        // If successful, update the isCopied state value
        setIsCopied(true)
        setTimeout(() => {
          setIsCopied(false)
        }, 1500)
      })
      .catch((err) => {
        console.log(err)
      })
  }

  return (
    <div className="">
      <button
        onClick={handleCopyClick}
        className="btn btn-square bg-purple-100 hover:bg-purple-200 text-purple-900 border-0"
      >
        <span>{!isCopied ? <FaCopy /> : <FaCheck />}</span>
      </button>
    </div>
  )
}

export default CopyButton
