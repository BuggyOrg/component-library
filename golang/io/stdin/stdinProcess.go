func stdinProcess(output chan string) {
  for {
    inputStr := ""
    _,err := fmt.Scanln(&inputStr)
    if err == nil {
      output <- inputStr
    } else {
      wg.Done()
      return
    }
  }
}
