export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) {
    const sanitizeErrorStack = (error: Error) => {
      if (!error.stack)
        return "";

      return error.stack
        .split("\n")
        .map((line) => {
          const match = line.match(/\((.+?):(\d+):(\d+)\)/);
          if (match && !match[1]) {
            return line.replace(/\((.+?):(\d+):(\d+)\)/, "(<unknown>)");
          }
          return line;
        })
        .join("\n");
    };

    process.on("unhandledRejection", (reason) => {
      if (reason instanceof Error) {
        const sanitizedStack = sanitizeErrorStack(reason);
        console.error("[Unhandled Rejection]", reason.message);
        if (sanitizedStack) {
          console.error(sanitizedStack.split("\n").slice(0, 10).join("\n"));
        }
      }
      else {
        console.error("[Unhandled Rejection]", reason);
      }
    });

    nitroApp.hooks.hook("error", (error) => {
      if (error instanceof Error) {
        sanitizeErrorStack(error);
      }
    });
  }
});
