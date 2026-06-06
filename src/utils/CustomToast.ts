import { toast } from "react-toastify";

export default function Toast(type: string, message: string) {
  switch (type) {
    case "success":
      return toast.success(message);
    case "error":
      return toast.error(message);
    default:
      break;
  }
}
