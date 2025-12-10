/**
 * 에러 로깅 유틸리티
 * GitHub Actions 등에서 에러 객체가 [object Object]로 표시되는 문제 해결
 */

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const errorInfo: Record<string, unknown> = {
      message: error.message,
      name: error.name,
    };

    if (error.stack) {
      errorInfo.stack = error.stack;
    }

    // Error 객체의 추가 속성들도 포함
    const additionalProps: Record<string, unknown> = {};
    for (const key in error) {
      if (key !== "message" && key !== "name" && key !== "stack") {
        try {
          additionalProps[key] = (error as unknown as Record<string, unknown>)[key];
        } catch {
          // 순환 참조 등으로 인한 오류 무시
        }
      }
    }

    if (Object.keys(additionalProps).length > 0) {
      errorInfo.additional = additionalProps;
    }

    return JSON.stringify(errorInfo, null, 2);
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      // 순환 참조 등으로 인한 오류 시 간단한 문자열로 변환
      return String(error);
    }
  }

  return String(error);
}

export function logError(message: string, error: unknown): void {
  console.error(message);
  console.error(formatError(error));
}

