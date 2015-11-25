func incProcess(i chan int, inc chan int) {
  for {
    v := <- i
    inc <- v + 1
  }
}
