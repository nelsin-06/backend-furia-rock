/**
 * @param {number} n
 * @return {number[]}
 */
var getNoZeroIntegers = function (n) {

    const numbers = []
    let result = []
    for (let i = 1; i <= n; i++) {
        const num1 = i
        const num2 = n - i

        const numberString1 = String(num1).split(',')
        const numberString2 = String(num2).split(',')

        if (!numberString1[numberString1.length - 1].includes('0') && !numberString2[numberString2.length - 1].includes('0')) {
            if ((num1 + num2) === n) {
                result = [num1, num2]
            }
        }
    }

    return result
};

getNoZeroIntegers(11)