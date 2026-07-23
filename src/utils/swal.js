import Swal from 'sweetalert2';

const baseConfig = {
  confirmButtonColor: '#1d4ed8',
  cancelButtonColor: '#6b7280',
  customClass: {
    popup: 'rounded-2xl',
    title: 'text-lg font-bold',
    confirmButton: 'rounded-xl px-6 py-2.5 text-sm font-semibold',
    cancelButton: 'rounded-xl px-6 py-2.5 text-sm font-medium',
  },
};

export const swal = {
  success(title, text) {
    return Swal.fire({
      ...baseConfig,
      icon: 'success',
      title: title || 'Success',
      text: text || '',
      confirmButtonText: 'OK',
    });
  },

  error(title, text) {
    return Swal.fire({
      ...baseConfig,
      icon: 'error',
      title: title || 'Error',
      text: text || '',
      confirmButtonText: 'OK',
    });
  },

  warning(title, text) {
    return Swal.fire({
      ...baseConfig,
      icon: 'warning',
      title: title || 'Warning',
      text: text || '',
      confirmButtonText: 'OK',
    });
  },

  info(title, text) {
    return Swal.fire({
      ...baseConfig,
      icon: 'info',
      title: title || 'Info',
      text: text || '',
      confirmButtonText: 'OK',
    });
  },

  confirm(title, text, confirmText, cancelText) {
    return Swal.fire({
      ...baseConfig,
      icon: 'question',
      title: title || 'Are you sure?',
      text: text || '',
      showCancelButton: true,
      confirmButtonText: confirmText || 'Yes',
      cancelButtonText: cancelText || 'No',
    });
  },

  toast(message, icon) {
    return Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      icon: icon || 'success',
      title: message,
      customClass: {
        popup: 'rounded-xl',
      },
    });
  },
};

export default swal;
